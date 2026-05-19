export interface Site {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  description?: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_root: boolean;
  role: string;
  user_token?: string;
  default_site_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSyncState {
  user: AdminUser & { user_token: string };
  scopes: UserAccessScope[];
}

export interface UserAccessScope {
  id: string;
  user_id: string;
  site_id: string;
  can_view: boolean;
  can_operate: boolean;
  can_manage_catalog: boolean;
}

export interface Device {
  id: string;
  code: string;
  name: string;
  site_id: string;
  is_active: boolean;
  device_token?: string;
}

export interface DeviceWithToken extends Device {
  device_token: string;
}
