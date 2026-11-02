// Supabase project the app talks to. Both values are public (safe in the browser);
// security comes from the row level security rules on the database.
// .env.local can override them (e.g. for a second test project).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rzzhslbotgumhfvkfgvo.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_M0GtPP8zy2aZqgLLjjIQNw_yOH0VxzI";

// Public contact details on the website. .env.local (NEXT_PUBLIC_CONTACT_WHATSAPP / _EMAIL) wins;
// otherwise these are used. WhatsApp: country code + number, digits only (e.g. 919876543210).
export const DEFAULT_CONTACT_WHATSAPP = "";
export const DEFAULT_CONTACT_EMAIL = "support@restropi.com";
