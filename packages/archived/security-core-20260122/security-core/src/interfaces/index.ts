/**
 * Stub interfaces file
 * This file provides placeholder interfaces that are imported but not fully defined
 */

export interface AuthServiceInterface {
  login(request: any): Promise<any>;
  register(request: any): Promise<any>;
  refreshToken(request: any): Promise<any>;
  logout(request: any): Promise<any>;
  changePassword(request: any): Promise<any>;
  resetPassword(request: any): Promise<any>;
}

export interface IAMServiceInterface {
  createUser(user: any): Promise<any>;
  updateUser(userId: string, user: any): Promise<any>;
  deleteUser(userId: string): Promise<any>;
  getUser(userId: string): Promise<any>;
  listUsers(filters?: any): Promise<any>;
  assignRole(userId: string, roleId: string): Promise<any>;
  revokeRole(userId: string, roleId: string): Promise<any>;
  grantPermission(userId: string, permission: any): Promise<any>;
  revokePermission(userId: string, permissionId: string): Promise<any>;
  checkAccess(userId: string, resource: string, action: string): Promise<boolean>;
}
