export interface AuthUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_root: boolean;
  role: string;
  default_site_id?: string;
}

export interface AuthContext {
  user: AuthUser;
  role: string;
  is_root: boolean;
  default_site?: SiteInfo;
  available_sites: SiteInfo[];
  permissions_summary: Record<string, unknown>;
  device?: DeviceInfo;
}

export interface SiteInfo {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface DeviceInfo {
  id: string;
  code: string;
  name: string;
}

export interface SyncUserPayload {
  id?: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_root: boolean;
  role: string;
  default_site_id?: string;
}
