const supabase = require('../config/supabase');

// ─── Categories ──────────────────────────────────────────────────────
const getCategories = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_categories')
        .select('*')
        .order('name', { ascending: true })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAuthors = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase.from('library_authors').select('*').order('name', { ascending: true })
    );
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPublishers = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase.from('library_publishers').select('*').order('name', { ascending: true })
    );
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getLicenses = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase.from('library_licenses').select('*').order('name', { ascending: true })
    );
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Items (Search & Discovery) ──────────────────────────────────────
const getItems = async (req, res) => {
  try {
    let query = supabase
      .from('library_items')
      .select(`
        *, 
        library_categories(name),
        library_books(*, library_publishers(name), library_licenses(*)),
        library_book_authors(library_authors(name))
      `)
      .order('created_at', { ascending: false });

    // Filters
    if (req.query.categoryId) {
      query = query.eq('category_id', req.query.categoryId);
    }
    if (req.query.type) {
      query = query.eq('type', req.query.type);
    }
    if (req.query.search) {
      query = query.or(`title.ilike.%${req.query.search}%,author.ilike.%${req.query.search}%`);
    }

    const { data, error } = await supabase.safeQuery(() => query);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Item Details with Reviews ───────────────────────────────────────
const getItemById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data: item, error: itemError } = await supabase.safeQuery(() =>
      supabase
        .from('library_items')
        .select(`
          *, 
          library_categories(name),
          library_books(*, library_publishers(name, website, location), library_licenses(*)),
          library_book_authors(library_authors(*)),
          library_book_sections(*),
          library_book_citations(*)
        `)
        .eq('id', id)
        .single()
    );

    if (itemError) throw itemError;

    // Fetch reviews
    const { data: reviews, error: reviewError } = await supabase.safeQuery(() =>
      supabase
        .from('library_reviews')
        .select('*, users(name, avatar_url)')
        .eq('item_id', id)
        .order('created_at', { ascending: false })
    );

    if (reviewError) throw reviewError;

    res.json({ ...item, reviews: reviews || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Toggle Favorite ─────────────────────────────────────────────────
const toggleFavorite = async (req, res) => {
  const { item_id } = req.body;
  const user_id = req.user.id;

  try {
    // Check if favorite exists
    const { data: existing, error: checkError } = await supabase.safeQuery(() =>
      supabase
        .from('library_favorites')
        .select('id')
        .eq('user_id', user_id)
        .eq('item_id', item_id)
        .single()
    );

    if (existing) {
      // Remove favorite
      const { error: deleteError } = await supabase.safeQuery(() =>
        supabase
          .from('library_favorites')
          .delete()
          .eq('id', existing.id)
      );
      if (deleteError) throw deleteError;
      return res.json({ message: 'Removed from favorites', favorited: false });
    } else {
      // Add favorite
      const { error: insertError } = await supabase.safeQuery(() =>
        supabase
          .from('library_favorites')
          .insert([{ user_id, item_id }])
      );
      if (insertError) throw insertError;
      return res.status(201).json({ message: 'Added to favorites', favorited: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get User Favorites ──────────────────────────────────────────────
const getFavorites = async (req, res) => {
  const user_id = req.user.id;
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_favorites')
        .select('*, library_items(*, library_categories(name))')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Add/Update Review ───────────────────────────────────────────────
const addReview = async (req, res) => {
  const { item_id, rating, review_text } = req.body;
  const user_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_reviews')
        .upsert(
          { user_id, item_id, rating, review_text },
          { onConflict: 'user_id, item_id' }
        )
        .select()
        .single()
    );

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Update Reading Progress ─────────────────────────────────────────
const updateProgress = async (req, res) => {
  const { item_id, progress_percentage } = req.body;
  const user_id = req.user.id;

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_progress')
        .upsert(
          { user_id, item_id, progress_percentage, last_read_at: new Date().toISOString() },
          { onConflict: 'user_id, item_id' }
        )
        .select()
        .single()
    );

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Get User Progress ───────────────────────────────────────────────
const getProgress = async (req, res) => {
  const user_id = req.user.id;
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_progress')
        .select('*, library_items(*, library_categories(name))')
        .eq('user_id', user_id)
        .order('last_read_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Toggle Bookmark ─────────────────────────────────────────────────
const toggleBookmark = async (req, res) => {
  const { item_id } = req.body;
  const user_id = req.user.id;

  try {
    // Check if bookmark exists
    const { data: existing, error: checkError } = await supabase.safeQuery(() =>
      supabase
        .from('library_bookmarks')
        .select('id')
        .eq('user_id', user_id)
        .eq('item_id', item_id)
        .single()
    );

    if (existing) {
      // Remove bookmark
      const { error: deleteError } = await supabase.safeQuery(() =>
        supabase
          .from('library_bookmarks')
          .delete()
          .eq('id', existing.id)
      );
      if (deleteError) throw deleteError;
      return res.json({ message: 'Removed from bookmarks', bookmarked: false });
    } else {
      // Add bookmark
      const { error: insertError } = await supabase.safeQuery(() =>
        supabase
          .from('library_bookmarks')
          .insert([{ user_id, item_id }])
      );
      if (insertError) throw insertError;
      return res.status(201).json({ message: 'Added to bookmarks', bookmarked: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── Get User Bookmarks ──────────────────────────────────────────────
const getBookmarks = async (req, res) => {
  const user_id = req.user.id;
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_bookmarks')
        .select('*, library_items(*, library_categories(name))')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN FUNCTIONS ─────────────────────────────────────────────────

// Helper to find or create publisher
const findOrCreatePublisher = async (name) => {
  if (!name) return null;
  const { data, error } = await supabase.safeQuery(() =>
    supabase.from('library_publishers').select('id').ilike('name', name.trim()).single()
  );
  if (data) return data.id;
  
  const { data: newData, error: newError } = await supabase.safeQuery(() =>
    supabase.from('library_publishers').insert([{ name: name.trim() }]).select('id').single()
  );
  if (newError) throw newError;
  return newData.id;
};

// Helper to find or create license
const findOrCreateLicense = async (name) => {
  if (!name) return null;
  const { data, error } = await supabase.safeQuery(() =>
    supabase.from('library_licenses').select('id').ilike('name', name.trim()).single()
  );
  if (data) return data.id;
  
  const { data: newData, error: newError } = await supabase.safeQuery(() =>
    supabase.from('library_licenses').insert([{ name: name.trim(), attribution_required: true }]).select('id').single()
  );
  if (newError) throw newError;
  return newData.id;
};

const createItem = async (req, res) => {
  const { book_metadata, author_ids, sections, citations, ...baseItem } = req.body;
  try {
    // 1. Handle Publisher and License if they are strings
    if (baseItem.type === 'Book' && book_metadata) {
      if (book_metadata.publisher && typeof book_metadata.publisher === 'string') {
        book_metadata.publisher_id = await findOrCreatePublisher(book_metadata.publisher);
        delete book_metadata.publisher;
      }
      if (book_metadata.license && typeof book_metadata.license === 'string') {
        book_metadata.license_id = await findOrCreateLicense(book_metadata.license);
        delete book_metadata.license;
      }
    }

    // 2. Insert Base Item
    const { data: item, error: itemError } = await supabase.safeQuery(() =>
      supabase.from('library_items').insert([baseItem]).select().single()
    );
    if (itemError) throw itemError;

    // 2. Handle Book Metadata if type is Book
    if (baseItem.type === 'Book' && book_metadata) {
      const { error: bookError } = await supabase.safeQuery(() =>
        supabase.from('library_books').insert([{ ...book_metadata, item_id: item.id }])
      );
      if (bookError) throw bookError;

      // 3. Handle Authors
      if (author_ids && author_ids.length > 0) {
        const bookAuthors = author_ids.map(author_id => ({ book_id: item.id, author_id }));
        const { error: authorError } = await supabase.safeQuery(() =>
          supabase.from('library_book_authors').insert(bookAuthors)
        );
        if (authorError) throw authorError;
      }

      // 4. Handle Sections
      if (sections && sections.length > 0) {
        const bookSections = sections.map(s => ({ ...s, book_id: item.id }));
        const { error: sectionError } = await supabase.safeQuery(() =>
          supabase.from('library_book_sections').insert(bookSections)
        );
        if (sectionError) throw sectionError;
      }

      // 5. Handle Citations
      if (citations && citations.length > 0) {
        const bookCitations = citations.map(c => ({ ...c, book_id: item.id }));
        const { error: citationError } = await supabase.safeQuery(() =>
          supabase.from('library_book_citations').insert(bookCitations)
        );
        if (citationError) throw citationError;
      }
    }

    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateItem = async (req, res) => {
  const { id } = req.params;
  const { book_metadata, author_ids, sections, citations, ...baseItem } = req.body;
  try {
    // 1. Update Base Item
    const { data: item, error: itemError } = await supabase.safeQuery(() =>
      supabase.from('library_items').update({ ...baseItem, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    );
    if (itemError) throw itemError;

    // 2. Handle Book Metadata
    if (baseItem.type === 'Book' && book_metadata) {
      if (book_metadata.publisher && typeof book_metadata.publisher === 'string') {
        book_metadata.publisher_id = await findOrCreatePublisher(book_metadata.publisher);
        delete book_metadata.publisher;
      }
      if (book_metadata.license && typeof book_metadata.license === 'string') {
        book_metadata.license_id = await findOrCreateLicense(book_metadata.license);
        delete book_metadata.license;
      }
      const { error: bookError } = await supabase.safeQuery(() =>
        supabase.from('library_books').upsert({ ...book_metadata, item_id: id })
      );
      if (bookError) throw bookError;

      // 3. Sync Authors
      if (author_ids !== undefined) {
        await supabase.from('library_book_authors').delete().eq('book_id', id);
        if (author_ids.length > 0) {
          const bookAuthors = author_ids.map(author_id => ({ book_id: id, author_id }));
          await supabase.from('library_book_authors').insert(bookAuthors);
        }
      }

      // 4. Sync Sections
      if (sections !== undefined) {
        await supabase.from('library_book_sections').delete().eq('book_id', id);
        if (sections.length > 0) {
          const bookSections = sections.map(s => ({ ...s, book_id: id }));
          await supabase.from('library_book_sections').insert(bookSections);
        }
      }

      // 5. Sync Citations
      if (citations !== undefined) {
        await supabase.from('library_book_citations').delete().eq('book_id', id);
        if (citations.length > 0) {
          const bookCitations = citations.map(c => ({ ...c, book_id: id }));
          await supabase.from('library_book_citations').insert(bookCitations);
        }
      }
    }

    res.json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteItem = async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.safeQuery(() =>
      supabase
        .from('library_items')
        .delete()
        .eq('id', id)
    );

    if (error) throw error;
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getCategories,
  getItems,
  getItemById,
  toggleFavorite,
  getFavorites,
  addReview,
  updateProgress,
  getProgress,
  toggleBookmark,
  getBookmarks,
  createItem,
  updateItem,
  deleteItem,
  getAuthors,
  getPublishers,
  getLicenses
};
