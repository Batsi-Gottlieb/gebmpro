import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // עוזר לאתר בעיות תצורה מהר - בדקו את קובץ .env בשורש הפרויקט
  console.error(
    'חסרים משתני סביבה: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'ודאו שקובץ .env קיים ושהרצתם מחדש את שרת הפיתוח (npm run dev) אחרי יצירתו.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// כתובת הבסיס לקריאות ל-Edge Functions
export const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;
