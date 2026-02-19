import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ilpcjpbmweflokspgzxq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1SBOIkbH1TkroVsB0NVG1g_M9V9Sg7w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
