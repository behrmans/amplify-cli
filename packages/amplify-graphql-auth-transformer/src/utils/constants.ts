import { ModelOperation } from './definitions';
export const DEFAULT_OWNER_FIELD = 'owner';
export const DEFAULT_GROUPS_FIELD = 'groups';
export const DEFAULT_IDENTITY_CLAIM = 'cognito:username';
export const DEFAULT_GROUP_CLAIM = 'cognito:groups';
export const ON_CREATE_FIELD = 'onCreate';
export const ON_UPDATE_FIELD = 'onUpdate';
export const ON_DELETE_FIELD = 'onDelete';
export const AUTH_NON_MODEL_TYPES = 'authNonModelTypes';
export const MODEL_OPERATIONS: ModelOperation[] = ['create', 'read', 'update', 'delete'];
