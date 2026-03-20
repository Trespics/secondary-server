const supabase = require('../config/supabase');

const submitContactForm = async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('contact_messages')
        .insert([{ name, email, subject, message, status: 'pending' }])
        .select()
        .single()
    );

    if (error) throw error;
    res.status(201).json({ message: 'Message sent successfully', data });
  } catch (error) {
    console.error('Submit contact form error:', error);
    res.status(500).json({ error: error.message });
  }
};

const subscribeNewsletter = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const { data, error } = await supabase.safeQuery(() =>
      supabase
        .from('newsletter_subscribers')
        .insert([{ email, is_active: true }])
        .select()
        .single()
    );

    if (error) {
      if (error.code === '23505') {
         // Gracefully handle duplicate emails
         return res.status(200).json({ message: 'Already subscribed' });
      }
      throw error;
    }

    res.status(201).json({ message: 'Subscibed successfully', data });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  submitContactForm,
  subscribeNewsletter
};
