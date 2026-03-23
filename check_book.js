
const supabase = require('./src/config/supabase');

async function checkBook() {
  const id = 'f3422579-91e9-428b-a3e6-be5a95f9d976';
  try {
    const { data: item, error } = await supabase.safeQuery(() =>
      supabase
        .from('library_items')
        .select(`
          *, 
          library_books(*),
          library_book_sections(*)
        `)
        .eq('id', id)
        .single()
    );

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Book Data:', JSON.stringify(item, null, 2));
  } catch (err) {
    console.error('Catch Error:', err);
  }
}

checkBook();
