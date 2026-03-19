const supabase = require('./src/config/supabase');

async function findStudent() {
  const { data, error } = await supabase
    .from('users')
    .select('email, role')
    .eq('role', 'student')
    .limit(1);

  if (error) {
    console.error('Error fetching student:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Found student:', data[0].email);
  } else {
    console.log('No student found in database.');
  }
}

findStudent();
