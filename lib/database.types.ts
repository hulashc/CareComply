export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          absence_type: string
          approved_at: string | null
          approved_by: string | null
          carer_id: string
          created_at: string
          end_date: string
          id: string
          org_id: string | null
          reason: string | null
          start_date: string
          status: string
        }
        Insert: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          carer_id: string
          created_at?: string
          end_date: string
          id?: string
          org_id?: string | null
          reason?: string | null
          start_date: string
          status?: string
        }
        Update: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          carer_id?: string
          created_at?: string
          end_date?: string
          id?: string
          org_id?: string | null
          reason?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          full_name: string | null
          id: string
          is_superadmin: boolean
          org_id: string | null
          role: string | null
        }
        Insert: {
          full_name?: string | null
          id: string
          is_superadmin?: boolean
          org_id?: string | null
          role?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string
          is_superadmin?: boolean
          org_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json | null
          org_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          document_category: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          uploaded_at: string
        }
        Insert: {
          application_id: string
          document_category: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
        }
        Update: {
          application_id?: string
          document_category?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_sort_code: string | null
          consents_to_dbs_check: boolean | null
          conviction_details: string | null
          country_of_origin: string | null
          created_at: string
          date_of_birth: string | null
          declaration_accepted: boolean | null
          driving_licence_expiry: string | null
          email: string | null
          full_name: string
          has_convictions_to_disclose: boolean | null
          has_driving_licence: boolean | null
          id: string
          invite_expires_at: string | null
          invite_token: string
          invited_at: string
          is_sponsored_visa: boolean | null
          is_uk_eea_citizen: boolean | null
          national_insurance_number: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          org_id: string
          phone: string | null
          postcode: string | null
          referee_1_contact: string | null
          referee_1_name: string | null
          referee_1_relationship: string | null
          referee_2_contact: string | null
          referee_2_name: string | null
          referee_2_relationship: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          right_to_work_uk: boolean | null
          sharecode: string | null
          signature_typed_name: string | null
          status: string
          student_visa_term_dates: string | null
          submitted_at: string | null
          visa_number: string | null
          visa_status: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_sort_code?: string | null
          consents_to_dbs_check?: boolean | null
          conviction_details?: string | null
          country_of_origin?: string | null
          created_at?: string
          date_of_birth?: string | null
          declaration_accepted?: boolean | null
          driving_licence_expiry?: string | null
          email?: string | null
          full_name: string
          has_convictions_to_disclose?: boolean | null
          has_driving_licence?: boolean | null
          id?: string
          invite_expires_at?: string | null
          invite_token: string
          invited_at?: string
          is_sponsored_visa?: boolean | null
          is_uk_eea_citizen?: boolean | null
          national_insurance_number?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          org_id: string
          phone?: string | null
          postcode?: string | null
          referee_1_contact?: string | null
          referee_1_name?: string | null
          referee_1_relationship?: string | null
          referee_2_contact?: string | null
          referee_2_name?: string | null
          referee_2_relationship?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          right_to_work_uk?: boolean | null
          sharecode?: string | null
          signature_typed_name?: string | null
          status?: string
          student_visa_term_dates?: string | null
          submitted_at?: string | null
          visa_number?: string | null
          visa_status?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_sort_code?: string | null
          consents_to_dbs_check?: boolean | null
          conviction_details?: string | null
          country_of_origin?: string | null
          created_at?: string
          date_of_birth?: string | null
          declaration_accepted?: boolean | null
          driving_licence_expiry?: string | null
          email?: string | null
          full_name?: string
          has_convictions_to_disclose?: boolean | null
          has_driving_licence?: boolean | null
          id?: string
          invite_expires_at?: string | null
          invite_token?: string
          invited_at?: string
          is_sponsored_visa?: boolean | null
          is_uk_eea_citizen?: boolean | null
          national_insurance_number?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          org_id?: string
          phone?: string | null
          postcode?: string | null
          referee_1_contact?: string | null
          referee_1_name?: string | null
          referee_1_relationship?: string | null
          referee_2_contact?: string | null
          referee_2_name?: string | null
          referee_2_relationship?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          right_to_work_uk?: boolean | null
          sharecode?: string | null
          signature_typed_name?: string | null
          status?: string
          student_visa_term_dates?: string | null
          submitted_at?: string | null
          visa_number?: string | null
          visa_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          category: string
          client_id: string
          created_at: string
          id: string
          next_review_date: string | null
          notes: string | null
          org_id: string | null
          scores: Json | null
          status: string
          title: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          category?: string
          client_id: string
          created_at?: string
          id?: string
          next_review_date?: string | null
          notes?: string | null
          org_id?: string | null
          scores?: Json | null
          status?: string
          title: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          category?: string
          client_id?: string
          created_at?: string
          id?: string
          next_review_date?: string | null
          notes?: string | null
          org_id?: string | null
          scores?: Json | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: string | null
          entity_id: string | null
          entity_type: string
          id: string
          org_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          org_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_notes: {
        Row: {
          carer_id: string | null
          client_id: string
          created_at: string
          fluids: string | null
          id: string
          mood: string | null
          note_text: string
          note_type: string
          nutrition: string | null
          org_id: string | null
        }
        Insert: {
          carer_id?: string | null
          client_id: string
          created_at?: string
          fluids?: string | null
          id?: string
          mood?: string | null
          note_text: string
          note_type?: string
          nutrition?: string | null
          org_id?: string | null
        }
        Update: {
          carer_id?: string | null
          client_id?: string
          created_at?: string
          fluids?: string | null
          id?: string
          mood?: string | null
          note_text?: string
          note_type?: string
          nutrition?: string | null
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_notes_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          goals: string | null
          id: string
          interventions: string | null
          notes: string | null
          org_id: string | null
          review_date: string | null
          reviewed_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          goals?: string | null
          id?: string
          interventions?: string | null
          notes?: string | null
          org_id?: string | null
          review_date?: string | null
          reviewed_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          goals?: string | null
          id?: string
          interventions?: string | null
          notes?: string | null
          org_id?: string | null
          review_date?: string | null
          reviewed_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      carer_contacts: {
        Row: {
          carer_id: string
          created_at: string
          id: string
          is_primary: boolean
          name: string
          org_id: string
          phone: string
          relationship: string | null
        }
        Insert: {
          carer_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          org_id: string
          phone: string
          relationship?: string | null
        }
        Update: {
          carer_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          org_id?: string
          phone?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carer_contacts_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carer_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      carer_references: {
        Row: {
          carer_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          org_id: string
          organisation: string | null
          phone: string | null
          received: boolean
          relationship: string | null
          verified: boolean
        }
        Insert: {
          carer_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          org_id: string
          organisation?: string | null
          phone?: string | null
          received?: boolean
          relationship?: string | null
          verified?: boolean
        }
        Update: {
          carer_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          organisation?: string | null
          phone?: string | null
          received?: boolean
          relationship?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "carer_references_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carer_references_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      carers: {
        Row: {
          address: string | null
          auth_id: string | null
          availability: Json | null
          bank_account_enc: string | null
          bank_account_name: string | null
          bank_sort_code_enc: string | null
          contract_hours: number | null
          created_at: string | null
          dbs_issue_date: string | null
          dbs_level: string | null
          dbs_number: string | null
          dbs_update_service: boolean
          dob: string | null
          driving_licence: boolean
          email: string | null
          employment_type: string | null
          full_name: string
          gender: string | null
          has_vehicle: boolean
          health_declaration: string | null
          id: string
          is_available: boolean | null
          location_id: string | null
          ni_number_enc: string | null
          notes: string | null
          org_id: string | null
          pay_grade: string | null
          phone: string | null
          postcode: string | null
          probation_end: string | null
          right_to_work_expiry: string | null
          right_to_work_status: string | null
          role: string
          start_date: string | null
          status: string | null
          vehicle_insured: boolean
        }
        Insert: {
          address?: string | null
          auth_id?: string | null
          availability?: Json | null
          bank_account_enc?: string | null
          bank_account_name?: string | null
          bank_sort_code_enc?: string | null
          contract_hours?: number | null
          created_at?: string | null
          dbs_issue_date?: string | null
          dbs_level?: string | null
          dbs_number?: string | null
          dbs_update_service?: boolean
          dob?: string | null
          driving_licence?: boolean
          email?: string | null
          employment_type?: string | null
          full_name: string
          gender?: string | null
          has_vehicle?: boolean
          health_declaration?: string | null
          id?: string
          is_available?: boolean | null
          location_id?: string | null
          ni_number_enc?: string | null
          notes?: string | null
          org_id?: string | null
          pay_grade?: string | null
          phone?: string | null
          postcode?: string | null
          probation_end?: string | null
          right_to_work_expiry?: string | null
          right_to_work_status?: string | null
          role?: string
          start_date?: string | null
          status?: string | null
          vehicle_insured?: boolean
        }
        Update: {
          address?: string | null
          auth_id?: string | null
          availability?: Json | null
          bank_account_enc?: string | null
          bank_account_name?: string | null
          bank_sort_code_enc?: string | null
          contract_hours?: number | null
          created_at?: string | null
          dbs_issue_date?: string | null
          dbs_level?: string | null
          dbs_number?: string | null
          dbs_update_service?: boolean
          dob?: string | null
          driving_licence?: boolean
          email?: string | null
          employment_type?: string | null
          full_name?: string
          gender?: string | null
          has_vehicle?: boolean
          health_declaration?: string | null
          id?: string
          is_available?: boolean | null
          location_id?: string | null
          ni_number_enc?: string | null
          notes?: string | null
          org_id?: string | null
          pay_grade?: string | null
          phone?: string | null
          postcode?: string | null
          probation_end?: string | null
          right_to_work_expiry?: string | null
          right_to_work_status?: string | null
          role?: string
          start_date?: string | null
          status?: string | null
          vehicle_insured?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "carers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          address: string | null
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          org_id: string
          phone: string | null
          relationship: string | null
          type: string
        }
        Insert: {
          address?: string | null
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          org_id: string
          phone?: string | null
          relationship?: string | null
          type: string
        }
        Update: {
          address?: string | null
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          relationship?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          access_instructions: string | null
          address: string | null
          advocate: string | null
          allergies: string[]
          capacity_status: string | null
          care_notes: string | null
          communication_needs: string | null
          conditions: string[]
          consent_to_care: boolean
          consent_to_share: boolean
          created_at: string | null
          dietary_needs: string | null
          dislikes: string | null
          dnacpr: boolean
          dob: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          ethnicity: string | null
          full_name: string
          funding_ref: string | null
          funding_source: string | null
          gender: string | null
          id: string
          interpreter_needed: boolean
          key_worker_id: string | null
          life_history: string | null
          likes: string | null
          local_authority: string | null
          location_id: string | null
          lpa_holder: string | null
          mobility_level: string | null
          nhs_number: string | null
          org_id: string | null
          phone: string | null
          photo_url: string | null
          postcode: string | null
          preferred_name: string | null
          primary_language: string | null
          pronouns: string | null
          religion: string | null
          risk_flags: Json
          status: string
          title: string | null
        }
        Insert: {
          access_instructions?: string | null
          address?: string | null
          advocate?: string | null
          allergies?: string[]
          capacity_status?: string | null
          care_notes?: string | null
          communication_needs?: string | null
          conditions?: string[]
          consent_to_care?: boolean
          consent_to_share?: boolean
          created_at?: string | null
          dietary_needs?: string | null
          dislikes?: string | null
          dnacpr?: boolean
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          ethnicity?: string | null
          full_name: string
          funding_ref?: string | null
          funding_source?: string | null
          gender?: string | null
          id?: string
          interpreter_needed?: boolean
          key_worker_id?: string | null
          life_history?: string | null
          likes?: string | null
          local_authority?: string | null
          location_id?: string | null
          lpa_holder?: string | null
          mobility_level?: string | null
          nhs_number?: string | null
          org_id?: string | null
          phone?: string | null
          photo_url?: string | null
          postcode?: string | null
          preferred_name?: string | null
          primary_language?: string | null
          pronouns?: string | null
          religion?: string | null
          risk_flags?: Json
          status?: string
          title?: string | null
        }
        Update: {
          access_instructions?: string | null
          address?: string | null
          advocate?: string | null
          allergies?: string[]
          capacity_status?: string | null
          care_notes?: string | null
          communication_needs?: string | null
          conditions?: string[]
          consent_to_care?: boolean
          consent_to_share?: boolean
          created_at?: string | null
          dietary_needs?: string | null
          dislikes?: string | null
          dnacpr?: boolean
          dob?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          ethnicity?: string | null
          full_name?: string
          funding_ref?: string | null
          funding_source?: string | null
          gender?: string | null
          id?: string
          interpreter_needed?: boolean
          key_worker_id?: string | null
          life_history?: string | null
          likes?: string | null
          local_authority?: string | null
          location_id?: string | null
          lpa_holder?: string | null
          mobility_level?: string | null
          nhs_number?: string | null
          org_id?: string | null
          phone?: string | null
          photo_url?: string | null
          postcode?: string | null
          preferred_name?: string | null
          primary_language?: string | null
          pronouns?: string | null
          religion?: string | null
          risk_flags?: Json
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_key_worker_id_fkey"
            columns: ["key_worker_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          compliance_score: number | null
          compliant_carers: number | null
          created_at: string
          documents_compliant: number | null
          documents_expired: number | null
          documents_expiring: number | null
          id: string
          metric_date: string
          open_incidents: number | null
          org_id: string
          total_carers: number | null
          total_clients: number | null
        }
        Insert: {
          compliance_score?: number | null
          compliant_carers?: number | null
          created_at?: string
          documents_compliant?: number | null
          documents_expired?: number | null
          documents_expiring?: number | null
          id?: string
          metric_date: string
          open_incidents?: number | null
          org_id: string
          total_carers?: number | null
          total_clients?: number | null
        }
        Update: {
          compliance_score?: number | null
          compliant_carers?: number | null
          created_at?: string
          documents_compliant?: number | null
          documents_expired?: number | null
          documents_expiring?: number | null
          id?: string
          metric_date?: string
          open_incidents?: number | null
          org_id?: string
          total_carers?: number | null
          total_clients?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          applies_to: string | null
          id: string
          is_mandatory: boolean | null
          name: string
          org_id: string | null
          renewal_lead_days: number | null
        }
        Insert: {
          applies_to?: string | null
          id?: string
          is_mandatory?: boolean | null
          name: string
          org_id?: string | null
          renewal_lead_days?: number | null
        }
        Update: {
          applies_to?: string | null
          id?: string
          is_mandatory?: boolean | null
          name?: string
          org_id?: string | null
          renewal_lead_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          confidence_scores: Json | null
          deleted_at: string | null
          deleted_by: string | null
          document_type_id: string | null
          expiry_date: string | null
          extracted_data: Json | null
          file_path: string | null
          id: string
          org_id: string | null
          owner_id: string
          owner_type: string | null
          status: string | null
          uploaded_at: string | null
          verified: boolean | null
        }
        Insert: {
          confidence_scores?: Json | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_type_id?: string | null
          expiry_date?: string | null
          extracted_data?: Json | null
          file_path?: string | null
          id?: string
          org_id?: string | null
          owner_id: string
          owner_type?: string | null
          status?: string | null
          uploaded_at?: string | null
          verified?: boolean | null
        }
        Update: {
          confidence_scores?: Json | null
          deleted_at?: string | null
          deleted_by?: string | null
          document_type_id?: string | null
          expiry_date?: string | null
          extracted_data?: Json | null
          file_path?: string | null
          id?: string
          org_id?: string | null
          owner_id?: string
          owner_type?: string | null
          status?: string | null
          uploaded_at?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_links: {
        Row: {
          created_at: string | null
          expires_at: string
          form_template_id: string | null
          id: string
          recipient_id: string | null
          recipient_type: string | null
          token: string | null
          used: boolean | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          form_template_id?: string | null
          id?: string
          recipient_id?: string | null
          recipient_type?: string | null
          token?: string | null
          used?: boolean | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          form_template_id?: string | null
          id?: string
          recipient_id?: string | null
          recipient_type?: string | null
          token?: string | null
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "form_links_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          org_id: string | null
          schema: Json
          target_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
          schema: Json
          target_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
          schema?: Json
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_notes: {
        Row: {
          client_id: string
          concerns: string | null
          created_at: string
          from_carer_id: string | null
          id: string
          is_read: boolean
          mood: string | null
          note_text: string
          org_id: string | null
          shift_id: string | null
          tasks_completed: string | null
          tasks_remaining: string | null
          to_carer_id: string | null
        }
        Insert: {
          client_id: string
          concerns?: string | null
          created_at?: string
          from_carer_id?: string | null
          id?: string
          is_read?: boolean
          mood?: string | null
          note_text: string
          org_id?: string | null
          shift_id?: string | null
          tasks_completed?: string | null
          tasks_remaining?: string | null
          to_carer_id?: string | null
        }
        Update: {
          client_id?: string
          concerns?: string | null
          created_at?: string
          from_carer_id?: string | null
          id?: string
          is_read?: boolean
          mood?: string | null
          note_text?: string
          org_id?: string | null
          shift_id?: string | null
          tasks_completed?: string | null
          tasks_remaining?: string | null
          to_carer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handover_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_notes_from_carer_id_fkey"
            columns: ["from_carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_notes_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_notes_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_carer_shift_conflicts"
            referencedColumns: ["shift_a_id"]
          },
          {
            foreignKeyName: "handover_notes_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_carer_shift_conflicts"
            referencedColumns: ["shift_b_id"]
          },
          {
            foreignKeyName: "handover_notes_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "v_unassigned_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_notes_to_carer_id_fkey"
            columns: ["to_carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          action_taken: string | null
          carer_id: string | null
          category: string
          client_id: string
          created_at: string
          description: string
          id: string
          org_id: string | null
          reported_at: string
          resolved_at: string | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          action_taken?: string | null
          carer_id?: string | null
          category?: string
          client_id: string
          created_at?: string
          description: string
          id?: string
          org_id?: string | null
          reported_at?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          action_taken?: string | null
          carer_id?: string | null
          category?: string
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          org_id?: string | null
          reported_at?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_logs: {
        Row: {
          administered_at: string
          carer_id: string | null
          created_at: string
          id: string
          medication_id: string
          notes: string | null
          org_id: string | null
          status: string
        }
        Insert: {
          administered_at?: string
          carer_id?: string | null
          created_at?: string
          id?: string
          medication_id: string
          notes?: string | null
          org_id?: string | null
          status?: string
        }
        Update: {
          administered_at?: string
          carer_id?: string | null
          created_at?: string
          id?: string
          medication_id?: string
          notes?: string | null
          org_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          client_id: string
          created_at: string
          dosage: string
          drug_name: string
          end_date: string | null
          frequency: string
          id: string
          notes: string | null
          org_id: string | null
          prescribed_by: string | null
          route: string
          start_date: string
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string
          dosage: string
          drug_name: string
          end_date?: string | null
          frequency: string
          id?: string
          notes?: string | null
          org_id?: string | null
          prescribed_by?: string | null
          route?: string
          start_date: string
          status?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          dosage?: string
          drug_name?: string
          end_date?: string | null
          frequency?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          prescribed_by?: string | null
          route?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          seats_purchased: number | null
          stripe_customer_id: string | null
          subscription_id: string | null
          subscription_status: string | null
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          seats_purchased?: number | null
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          seats_purchased?: number | null
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      qualifications: {
        Row: {
          carer_id: string
          certificate_url: string | null
          created_at: string
          expiry_date: string | null
          id: string
          issued_date: string | null
          notes: string | null
          org_id: string | null
          qualification_type: string
          status: string
        }
        Insert: {
          carer_id: string
          certificate_url?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          org_id?: string | null
          qualification_type: string
          status?: string
        }
        Update: {
          carer_id?: string
          certificate_url?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          org_id?: string | null
          qualification_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualifications_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          carer_id: string | null
          client_id: string
          created_at: string
          end_time: string
          id: string
          location_id: string | null
          notes: string | null
          org_id: string | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          start_time: string
          status: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          carer_id?: string | null
          client_id: string
          created_at?: string
          end_time: string
          id?: string
          location_id?: string | null
          notes?: string | null
          org_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          start_time: string
          status?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          carer_id?: string | null
          client_id?: string
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          org_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          carer_id: string | null
          category: string
          client_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          org_id: string | null
          priority: string
          status: string
          title: string
        }
        Insert: {
          carer_id?: string | null
          category?: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          priority?: string
          status?: string
          title: string
        }
        Update: {
          carer_id?: string | null
          category?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          org_id?: string | null
          priority?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_carer_shift_conflicts: {
        Row: {
          carer_id: string | null
          org_id: string | null
          overlap_end: string | null
          overlap_start: string | null
          shift_a_client_id: string | null
          shift_a_end: string | null
          shift_a_id: string | null
          shift_a_start: string | null
          shift_b_client_id: string | null
          shift_b_end: string | null
          shift_b_id: string | null
          shift_b_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_carer_id_fkey"
            columns: ["carer_id"]
            isOneToOne: false
            referencedRelation: "carers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_client_id_fkey"
            columns: ["shift_b_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_client_id_fkey"
            columns: ["shift_a_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_unassigned_shifts: {
        Row: {
          client_id: string | null
          end_time: string | null
          id: string | null
          location_id: string | null
          notes: string | null
          org_id: string | null
          start_time: string | null
          status: string | null
        }
        Insert: {
          client_id?: string | null
          end_time?: string | null
          id?: string | null
          location_id?: string | null
          notes?: string | null
          org_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Update: {
          client_id?: string | null
          end_time?: string | null
          id?: string | null
          location_id?: string | null
          notes?: string | null
          org_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_document_status: { Args: { expiry: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
