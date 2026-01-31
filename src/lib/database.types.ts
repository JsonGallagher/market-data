export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			metric_types: {
				Row: {
					id: string;
					display_name: string;
					unit: string | null;
					format_pattern: string | null;
					min_value: number | null;
					max_value: number | null;
				};
				Insert: {
					id: string;
					display_name: string;
					unit?: string | null;
					format_pattern?: string | null;
					min_value?: number | null;
					max_value?: number | null;
				};
				Update: {
					id?: string;
					display_name?: string;
					unit?: string | null;
					format_pattern?: string | null;
					min_value?: number | null;
					max_value?: number | null;
				};
			};
			profiles: {
				Row: {
					id: string;
					email: string;
					full_name: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id: string;
					email: string;
					full_name?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					full_name?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			metrics: {
				Row: {
					id: number;
					user_id: string;
					metric_type_id: string;
					recorded_date: string;
					value: number;
					is_manually_entered: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					user_id: string;
					metric_type_id: string;
					recorded_date: string;
					value: number;
					is_manually_entered?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					user_id?: string;
					metric_type_id?: string;
					recorded_date?: string;
					value?: number;
					is_manually_entered?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			shared_links: {
				Row: {
					id: number;
					user_id: string;
					token: string;
					created_at: string;
				};
				Insert: {
					user_id: string;
					token?: string;
					created_at?: string;
				};
				Update: {
					user_id?: string;
					token?: string;
					created_at?: string;
				};
			};
			import_sources: {
				Row: {
					id: string;
					user_id: string;
					source_type: 'google_sheets' | 'csv' | 'excel' | 'manual';
					source_url: string | null;
					source_name: string;
					sheet_tab: string | null;
					last_imported_at: string;
					row_count: number | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					source_type: 'google_sheets' | 'csv' | 'excel' | 'manual';
					source_url?: string | null;
					source_name: string;
					sheet_tab?: string | null;
					last_imported_at?: string;
					row_count?: number | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					source_type?: 'google_sheets' | 'csv' | 'excel' | 'manual';
					source_url?: string | null;
					source_name?: string;
					sheet_tab?: string | null;
					last_imported_at?: string;
					row_count?: number | null;
					created_at?: string;
				};
			};
		};
		Views: {};
		Functions: {};
		Enums: {};
	};
};

export type MetricType = Database['public']['Tables']['metric_types']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Metric = Database['public']['Tables']['metrics']['Row'];
export type SharedLink = Database['public']['Tables']['shared_links']['Row'];
export type ImportSource = Database['public']['Tables']['import_sources']['Row'];
