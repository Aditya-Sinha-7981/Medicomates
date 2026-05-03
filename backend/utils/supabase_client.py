# Supabase singleton — import this everywhere, never create a new client yourself
# from utils.supabase_client import supabase

import os
from supabase import create_client, Client
from config import settings

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
