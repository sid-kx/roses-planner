// Supabase setup for The Rose Room Planner
// Important: This is the ANON PUBLIC key, not the service_role key.

const SUPABASE_URL = "https://zsohiwpwfeburwcilhpk.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzb2hpd3B3ZmVidXJ3Y2lsaHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzEwNDYsImV4cCI6MjA5MzA0NzA0Nn0.zu_E75L4aa-Wc_1G6Y3NNDQ3bx4BqHj7FHyjEG7tVLY";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);