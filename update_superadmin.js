const supabase = require('./src/config/supabase');

async function updateSuperAdminRole() {
  const email = 'tony@example.com'; // User should update this or I should find it
  console.log('Searching for user...');
  
  const { data: users, error: findError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('role', 'admin');

  if (findError) {
    console.error('Error finding users:', findError);
    return;
  }

  if (!users || users.length === 0) {
    console.log('No users with role "admin" found.');
    return;
  }

  console.log(`Found ${users.length} users with role "admin".`);
  
  for (const user of users) {
    console.log(`Updating user: ${user.email} (ID: ${user.id})...`);
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: 'superadmin' })
      .eq('id', user.id);

    if (updateError) {
      console.error(`Failed to update user ${user.email}:`, updateError);
    } else {
      console.log(`Successfully updated ${user.email} to "superadmin".`);
    }
  }
}

updateSuperAdminRole();
