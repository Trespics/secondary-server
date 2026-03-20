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

// ─── Items (Search & Discovery) ──────────────────────────────────────
const getItems = async (req, res) => {
  try {
    let query = supabase
      .from('library_items')
      .select('*, library_categories(name)')
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
        .select('*, library_categories(name)')
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

// ─── ADMIN FUNCTIONS ─────────────────────────────────────────────────

const createItem = async (req, res) => {
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_items')
        .insert([req.body])
        .select()
        .single()
    );

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateItem = async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_items')
        .update({ ...req.body, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    );

    if (error) throw error;
    res.json(data);
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
  createItem,
  updateItem,
  deleteItem
};
