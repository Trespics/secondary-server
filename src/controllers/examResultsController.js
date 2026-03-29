const supabase = require('../config/supabase');
const fs = require('fs');
const csv = require('csv-parser');

const logError = (context, error) => console.error(`[ERROR][${context}]`, error);
const logSuccess = (context, msg) => console.log(`[SUCCESS][${context}]`, msg);

const getAssignedSubjects = async (teacher_id, school_id) => {
  const { data, error } = await supabase.safeQuery(() =>
    supabase.from('class_subjects').select('class_id, subject_id').eq('teacher_id', teacher_id)
  );
  if (error) throw error;
  return data || [];
};

const getResults = async (req, res, isAdmin) => {
  try {
    const { class_id, term, exam_type, year } = req.query;
    let query = supabase.from('exam_results').select('*').eq('school_id', req.user.school_id);
    
    if (class_id) query = query.eq('class_id', class_id);
    if (term) query = query.eq('term', term);
    if (exam_type) query = query.eq('exam_type', exam_type);
    if (year) query = query.eq('year', year);

    // If teacher, only fetch subjects they teach
    if (!isAdmin) {
      const assignments = await getAssignedSubjects(req.user.id, req.user.school_id);
      if (assignments.length === 0) return res.json([]);
      const subjectClassPairs = assignments.map(a => `(class_id.eq.${a.class_id},and(subject_id.eq.${a.subject_id}))`).join(',');
      // Actually simpler logic: we can just fetch all for the class and let frontend filter, or we can filter by subject_ids teacher teaches.
      // Better way: get all subject_ids the teacher teaches
      const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
      if (subjectIds.length > 0) {
        query = query.in('subject_id', subjectIds);
      } else {
         return res.json([]);
      }
    }

    const { data, error } = await supabase.safeQuery(() => query);
    if (error) throw error;

    res.json(data);
  } catch (error) {
    logError('getResults', error);
    res.status(500).json({ error: error.message });
  }
};

const saveBulkResults = async (req, res, isAdmin) => {
  try {
    let { results } = req.body;
    // results should be array of { id? student_id, class_id, subject_id, exam_type, term, year, score, grade, remarks }
    
    if (!isAdmin) {
      const assignments = await getAssignedSubjects(req.user.id, req.user.school_id);
      const allowedSubjectIds = assignments.map(a => a.subject_id);
      results = results.filter(r => allowedSubjectIds.includes(r.subject_id));
    }

    const inserts = [];
    const updates = [];

    for (let r of results) {
      const row = {
        school_id: req.user.school_id,
        student_id: r.student_id,
        class_id: r.class_id,
        subject_id: r.subject_id,
        exam_type: r.exam_type,
        term: r.term,
        year: r.year,
        score: r.score,
        grade: r.grade,
        remarks: r.remarks,
        updated_at: new Date()
      };
      
      if (r.id) {
        updates.push({ id: r.id, ...row });
      } else {
        inserts.push(row);
      }
    }

    if (inserts.length > 0) {
      const { error: insError } = await supabase.safeQuery(() => supabase.from('exam_results').insert(inserts));
      if (insError) throw insError;
    }

    if (updates.length > 0) {
      for (let u of updates) {
        const { error: updError } = await supabase.safeQuery(() => supabase.from('exam_results').update(u).eq('id', u.id));
        if (updError) throw updError;
      }
    }

    logSuccess('saveBulkResults', `Saved ${inserts.length} inserts, ${updates.length} updates`);
    res.json({ message: 'Results saved successfully' });
  } catch (error) {
    logError('saveBulkResults', error);
    res.status(500).json({ error: error.message });
  }
};

const uploadResultsCSV = async (req, res, isAdmin) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        fs.unlinkSync(req.file.path);

        // Required columns in CSV: student_id, class_id, subject_id, exam_type, term, year, score
        let processedResults = results.map(r => ({
           student_id: r.student_id,
           class_id: r.class_id,
           subject_id: r.subject_id,
           exam_type: r.exam_type,
           term: r.term,
           year: parseInt(r.year),
           score: parseFloat(r.score),
           grade: r.grade || null,
           remarks: r.remarks || null
        }));

        if (!isAdmin) {
          const assignments = await getAssignedSubjects(req.user.id, req.user.school_id);
          const allowedSubjectIds = assignments.map(a => a.subject_id);
          processedResults = processedResults.filter(r => allowedSubjectIds.includes(r.subject_id));
        }

        const inserts = processedResults.map(r => ({
          school_id: req.user.school_id,
          ...r
        }));

        if (inserts.length > 0) {
           const { error } = await supabase.safeQuery(() => supabase.from('exam_results').insert(inserts));
           if (error) throw error;
        }

        res.json({ message: `Successfully imported ${inserts.length} results` });
      });
  } catch (error) {
    logError('uploadResultsCSV', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
};

exports.adminGetResults = (req, res) => getResults(req, res, true);
exports.adminSaveBulkResults = (req, res) => saveBulkResults(req, res, true);
exports.adminUploadResultsCSV = (req, res) => uploadResultsCSV(req, res, true);

exports.teacherGetResults = (req, res) => getResults(req, res, false);
exports.teacherSaveBulkResults = (req, res) => saveBulkResults(req, res, false);
exports.teacherUploadResultsCSV = (req, res) => uploadResultsCSV(req, res, false);

exports.studentGetResults = async (req, res) => {
  try {
    const { term, year, exam_type } = req.query;
    let query = supabase.from('exam_results')
      .select('*, subjects(name), classes(name)')
      .eq('student_id', req.user.id)
      .eq('school_id', req.user.school_id);
    
    if (term) query = query.eq('term', term);
    if (year) query = query.eq('year', year);
    if (exam_type) query = query.eq('exam_type', exam_type);

    const { data, error } = await supabase.safeQuery(() => query.order('created_at', { ascending: false }));
    if (error) throw error;
    res.json(data);
  } catch (error) {
    logError('studentGetResults', error);
    res.status(500).json({ error: error.message });
  }
};
