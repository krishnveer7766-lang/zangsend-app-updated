import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const listId = '004d7696-d396-4916-86fa-ff52ed5c7a38';
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('list_id', listId);

    if (error) throw error;

    console.log('Total contacts fetched:', contacts.length);
    
    // Check fields presence
    let hasEmail = 0;
    let hasLinkedin = 0;
    let hasName = 0;
    
    const duplicateEmails = {};
    
    contacts.forEach(c => {
      if (c.email) {
        hasEmail++;
        duplicateEmails[c.email] = (duplicateEmails[c.email] || 0) + 1;
      }
      if (c.linkedin_url) hasLinkedin++;
      if (c.first_name || c.last_name) hasName++;
    });

    console.log('Contacts with email:', hasEmail);
    console.log('Contacts with linkedin_url:', hasLinkedin);
    console.log('Contacts with name:', hasName);
    
    const duplicates = Object.entries(duplicateEmails).filter(([email, count]) => count > 1);
    console.log('Number of duplicate emails:', duplicates.length);
    if (duplicates.length > 0) {
      console.log('Duplicate examples:', duplicates.slice(0, 5));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
