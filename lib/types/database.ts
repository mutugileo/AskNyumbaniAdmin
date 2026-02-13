export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          id: string
          admin_user_id: string
          activity_type: string
          description: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_user_id: string
          activity_type: string
          description?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_user_id?: string
          activity_type?: string
          description?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          phone_number: string | null
          avatar_url: string | null
          bio: string | null
          location: string | null
          user_type: 'tenant' | 'landlord' | 'agent' | 'both'
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          phone_number?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          user_type?: 'tenant' | 'landlord' | 'agent' | 'both'
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          phone_number?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          user_type?: 'tenant' | 'landlord' | 'agent' | 'both'
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      properties: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string
          property_type: 'house' | 'apartment' | 'land' | 'commercial' | 'townhouse' | 'villa' | 'studio'
          deal_type: 'sale' | 'rent' | 'lease'
          price: number
          currency: string
          price_period: string | null
          bedrooms: number
          bathrooms: number
          kitchen_areas: number
          square_feet: number | null
          square_meters: number | null
          address: string
          city: string
          region: string
          county: string
          country: string
          postal_code: string | null
          latitude: number | null
          longitude: number | null
          land_details: Json | null
          status: 'draft' | 'available' | 'rented' | 'sold' | 'pending' | 'inactive'
          is_featured: boolean
          is_verified: boolean
          views_count: number
          favorites_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          description: string
          property_type: 'house' | 'apartment' | 'land' | 'commercial' | 'townhouse' | 'villa' | 'studio'
          deal_type: 'sale' | 'rent' | 'lease'
          price: number
          currency?: string
          price_period?: string | null
          bedrooms?: number
          bathrooms?: number
          kitchen_areas?: number
          square_feet?: number | null
          square_meters?: number | null
          address: string
          city: string
          region: string
          county: string
          country?: string
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          land_details?: Json | null
          status?: 'draft' | 'available' | 'rented' | 'sold' | 'pending' | 'inactive'
          is_featured?: boolean
          is_verified?: boolean
          views_count?: number
          favorites_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          description?: string
          property_type?: 'house' | 'apartment' | 'land' | 'commercial' | 'townhouse' | 'villa' | 'studio'
          deal_type?: 'sale' | 'rent' | 'lease'
          price?: number
          currency?: string
          price_period?: string | null
          bedrooms?: number
          bathrooms?: number
          kitchen_areas?: number
          square_feet?: number | null
          square_meters?: number | null
          address?: string
          city?: string
          region?: string
          county?: string
          country?: string
          postal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          land_details?: Json | null
          status?: 'draft' | 'available' | 'rented' | 'sold' | 'pending' | 'inactive'
          is_featured?: boolean
          is_verified?: boolean
          views_count?: number
          favorites_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      property_images: {
        Row: {
          id: string
          property_id: string
          image_url: string
          thumbnail_url: string | null
          caption: string | null
          is_primary: boolean
          display_order: number
          created_at: string
          // Admin review fields
          admin_approved: boolean | null
          admin_reviewed_at: string | null
          admin_reviewed_by: string | null
          admin_rejection_reason: string | null
          admin_comment: string | null
        }
        Insert: {
          id?: string
          property_id: string
          image_url: string
          thumbnail_url?: string | null
          caption?: string | null
          is_primary?: boolean
          display_order?: number
          created_at?: string
          admin_approved?: boolean | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          admin_rejection_reason?: string | null
          admin_comment?: string | null
        }
        Update: {
          id?: string
          property_id?: string
          image_url?: string
          thumbnail_url?: string | null
          caption?: string | null
          is_primary?: boolean
          display_order?: number
          created_at?: string
          admin_approved?: boolean | null
          admin_reviewed_at?: string | null
          admin_reviewed_by?: string | null
          admin_rejection_reason?: string | null
          admin_comment?: string | null
        }
      }
      relocation_catalog_submissions: {
        Row: {
          id: string
          submission_type:
            | 'mover_profile'
            | 'vehicle'
            | 'service_type'
            | 'inventory_template'
            | 'addon'
            | 'coverage_zone'
            | 'pricing_rule'
          title: string
          submitted_by_name: string
          submitted_by_contact: string
          submitted_by_user_id: string | null
          source: 'admin' | 'mobile_user' | 'partner_portal'
          location: string
          payload_summary: string
          payload: Json
          notes: string | null
          status: 'pending' | 'approved' | 'rejected'
          rejection_reason: string | null
          reviewed_by_user_id: string | null
          reviewed_by_name: string | null
          reviewed_at: string | null
          published: boolean
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          submission_type:
            | 'mover_profile'
            | 'vehicle'
            | 'service_type'
            | 'inventory_template'
            | 'addon'
            | 'coverage_zone'
            | 'pricing_rule'
          title: string
          submitted_by_name: string
          submitted_by_contact: string
          submitted_by_user_id?: string | null
          source?: 'admin' | 'mobile_user' | 'partner_portal'
          location: string
          payload_summary: string
          payload?: Json
          notes?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          rejection_reason?: string | null
          reviewed_by_user_id?: string | null
          reviewed_by_name?: string | null
          reviewed_at?: string | null
          published?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          submission_type?:
            | 'mover_profile'
            | 'vehicle'
            | 'service_type'
            | 'inventory_template'
            | 'addon'
            | 'coverage_zone'
            | 'pricing_rule'
          title?: string
          submitted_by_name?: string
          submitted_by_contact?: string
          submitted_by_user_id?: string | null
          source?: 'admin' | 'mobile_user' | 'partner_portal'
          location?: string
          payload_summary?: string
          payload?: Json
          notes?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          rejection_reason?: string | null
          reviewed_by_user_id?: string | null
          reviewed_by_name?: string | null
          reviewed_at?: string | null
          published?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      marketplace_item_submissions: {
        Row: {
          id: string
          domain: 'resale' | 'decor'
          item_type: string
          title: string
          submitted_by_name: string
          submitted_by_contact: string
          submitted_by_user_id: string | null
          source: 'vendor' | 'admin'
          location: string
          price: number | null
          currency: string
          description: string | null
          image_urls: Json
          payload: Json
          status: 'pending' | 'approved' | 'rejected'
          rejection_reason: string | null
          reviewed_by_user_id: string | null
          reviewed_by_name: string | null
          reviewed_at: string | null
          published: boolean
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          domain: 'resale' | 'decor'
          item_type: string
          title: string
          submitted_by_name: string
          submitted_by_contact: string
          submitted_by_user_id?: string | null
          source?: 'vendor' | 'admin'
          location: string
          price?: number | null
          currency?: string
          description?: string | null
          image_urls?: Json
          payload?: Json
          status?: 'pending' | 'approved' | 'rejected'
          rejection_reason?: string | null
          reviewed_by_user_id?: string | null
          reviewed_by_name?: string | null
          reviewed_at?: string | null
          published?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          domain?: 'resale' | 'decor'
          item_type?: string
          title?: string
          submitted_by_name?: string
          submitted_by_contact?: string
          submitted_by_user_id?: string | null
          source?: 'vendor' | 'admin'
          location?: string
          price?: number | null
          currency?: string
          description?: string | null
          image_urls?: Json
          payload?: Json
          status?: 'pending' | 'approved' | 'rejected'
          rejection_reason?: string | null
          reviewed_by_user_id?: string | null
          reviewed_by_name?: string | null
          reviewed_at?: string | null
          published?: boolean
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type PropertyImage = Database['public']['Tables']['property_images']['Row']
export type Property = Database['public']['Tables']['properties']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type AdminActivityLog = Database['public']['Tables']['admin_activity_log']['Row']
export type RelocationCatalogSubmission = Database['public']['Tables']['relocation_catalog_submissions']['Row']
export type MarketplaceItemSubmission = Database['public']['Tables']['marketplace_item_submissions']['Row']
