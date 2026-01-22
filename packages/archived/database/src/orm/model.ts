/**
 * ORM Model Layer
 * ActiveRecord-style models with relationships and hooks
 */

import { DatabaseAdapter } from '../adapters/adapter';
import { QueryBuilder } from '../query/builder';
import {
  ModelDefinition,
  ModelInstance,
  RelationDefinition,
  FieldDefinition,
  QueryCondition,
} from '../types';

// ============================================================================
// Base Model Class
// ============================================================================

export abstract class Model {
  protected static adapter: DatabaseAdapter;
  protected static definition: ModelDefinition;
  protected static relations: Record<string, RelationDefinition> = {};

  // Instance properties
  protected _attributes: Record<string, any> = {};
  protected _original: Record<string, any> = {};
  protected _exists: boolean = false;
  protected _loadedRelations: Set<string> = new Set();

  // ========================================================================
  // Static Configuration
  // ========================================================================

  static initialize(adapter: DatabaseAdapter, definition: ModelDefinition): void {
    (this as any).adapter = adapter;
    (this as any).definition = definition;
    (this as any).relations = definition.relations || {};
  }

  static getAdapter(): DatabaseAdapter {
    return (this as any).adapter;
  }

  static getDefinition(): ModelDefinition {
    return (this as any).definition;
  }

  static getTableName(): string {
    return (this as any).definition.tableName;
  }

  static getPrimaryKey(): string {
    return (this as any).definition.primaryKey || 'id';
  }

  // ========================================================================
  // Query Builder
  // ========================================================================

  static query<T extends Model>(this: new () => T): QueryBuilder {
    const adapter = (this as any).adapter;
    const tableName = (this as any).definition.tableName;
    return new QueryBuilder(adapter, tableName);
  }

  static where(field: string, operator: string, value?: any): QueryBuilder {
    return this.query().where(field, operator, value);
  }

  static whereIn(field: string, values: any[]): QueryBuilder {
    return this.query().whereIn(field, values);
  }

  static orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    return this.query().orderBy(field, direction);
  }

  // ========================================================================
  // Finders
  // ========================================================================

  static async find<T extends Model>(this: new () => T, id: any): Promise<T | null> {
    const primaryKey = this.getPrimaryKey();
    const result = await this.query().where(primaryKey, '=', id).first();

    if (!result) {
      return null;
    }

    const model = new this();
    model._attributes = result;
    model._original = { ...result };
    model._exists = true;
    return model;
  }

  static async findOrFail<T extends Model>(this: new () => T, id: any): Promise<T> {
    const model = await this.find(id);

    if (!model) {
      throw new Error(`Record with ID ${id} not found`);
    }

    return model;
  }

  static async findMany<T extends Model>(this: new () => T, ids: any[]): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }

    const primaryKey = this.getPrimaryKey();
    const results = await this.query().whereIn(primaryKey, ids).get();

    return results.map(row => {
      const model = new this();
      model._attributes = row;
      model._original = { ...row };
      model._exists = true;
      return model;
    });
  }

  static async first<T extends Model>(this: new () => T): Promise<T | null> {
    const result = await this.query().first();

    if (!result) {
      return null;
    }

    const model = new this();
    model._attributes = result;
    model._original = { ...result };
    model._exists = true;
    return model;
  }

  static async firstOrFail<T extends Model>(this: new () => T): Promise<T> {
    const model = await this.first();

    if (!model) {
      throw new Error('No records found');
    }

    return model;
  }

  static async all<T extends Model>(this: new () => T): Promise<T[]> {
    const results = await this.query().get();

    return results.map(row => {
      const model = new this();
      model._attributes = row;
      model._original = { ...row };
      model._exists = true;
      return model;
    });
  }

  static async get<T extends Model>(this: new () => T): Promise<T[]> {
    return this.all();
  }

  static async count(): Promise<number> {
    return this.query().count();
  }

  static async exists(): Promise<boolean> {
    return this.query().exists();
  }

  // ========================================================================
  // Aggregation
  // ========================================================================

  static async max(field: string): Promise<any> {
    return this.query().max(field);
  }

  static async min(field: string): Promise<any> {
    return this.query().min(field);
  }

  static async avg(field: string): Promise<number> {
    return this.query().avg(field);
  }

  static async sum(field: string): Promise<number> {
    return this.query().sum(field);
  }

  // ========================================================================
  // CRUD Operations
  // ========================================================================

  static async create<T extends Model>(this: new () => T, data: Record<string, any>): Promise<T> {
    const model = new this();
    model._attributes = { ...data };
    await model.save();
    return model;
  }

  static async update(id: any, data: Record<string, any>): Promise<boolean> {
    const primaryKey = this.getPrimaryKey();
    const adapter = (this as any).adapter;

    const result = await adapter.update(
      this.getTableName(),
      data,
      [{ field: primaryKey, operator: '=', value: id } as QueryCondition]
    );

    return (result.affectedRows || 0) > 0;
  }

  static async delete(id: any): Promise<boolean> {
    const primaryKey = this.getPrimaryKey();
    const adapter = (this as any).adapter;

    const result = await adapter.delete(
      this.getTableName(),
      [{ field: primaryKey, operator: '=', value: id } as QueryCondition]
    );

    return (result.affectedRows || 0) > 0;
  }

  // ========================================================================
  // Instance Methods
  // ========================================================================

  async save(): Promise<this> {
    const definition = (this.constructor as any).definition;
    const adapter = (this.constructor as any).adapter;
    const primaryKey = (this.constructor as any).definition.primaryKey || 'id';
    const timestamps = definition.timestamps !== false;

    // Run beforeSave hook
    await this.runHook('beforeSave');

    if (this._exists) {
      // Update
      await this.runHook('beforeUpdate');

      if (timestamps) {
        this._attributes.updatedAt = new Date();
      }

      const conditions: QueryCondition[] = [
        { field: primaryKey, operator: '=', value: this._attributes[primaryKey] },
      ];

      await adapter.update(
        definition.tableName,
        this._attributes,
        conditions
      );

      this._original = { ...this._attributes };
      await this.runHook('afterUpdate');
    } else {
      // Insert
      await this.runHook('beforeCreate');

      if (timestamps) {
        const now = new Date();
        this._attributes.createdAt = now;
        this._attributes.updatedAt = now;
      }

      const result = await adapter.insert(definition.tableName, this._attributes);

      if (result.insertId) {
        this._attributes[primaryKey] = result.insertId;
      }

      this._exists = true;
      this._original = { ...this._attributes };
      await this.runHook('afterCreate');
    }

    await this.runHook('afterSave');

    return this;
  }

  async delete(): Promise<boolean> {
    const definition = (this.constructor as any).definition;
    const adapter = (this.constructor as any).adapter;
    const primaryKey = definition.primaryKey || 'id';

    await this.runHook('beforeDelete');

    const softDelete = definition.softDelete;

    if (softDelete) {
      this._attributes.deletedAt = new Date();
      await this.save();
    } else {
      const conditions: QueryCondition[] = [
        { field: primaryKey, operator: '=', value: this._attributes[primaryKey] },
      ];

      const result = await adapter.delete(definition.tableName, conditions);

      if ((result.affectedRows || 0) === 0) {
        return false;
      }

      this._exists = false;
    }

    await this.runHook('afterDelete');

    return true;
  }

  async refresh(): Promise<this> {
    const primaryKey = (this.constructor as any).definition.primaryKey || 'id';
    const ModelClass = this.constructor as any;

    const result = await ModelClass.query()
      .where(primaryKey, '=', this._attributes[primaryKey])
      .first();

    if (result) {
      this._attributes = result;
      this._original = { ...result };
    }

    return this;
  }

  // ========================================================================
  // Attribute Access
  // ========================================================================

  get(attribute: string): any {
    const definition = (this.constructor as any).definition;
    const fieldDefinition: FieldDefinition = definition.schema?.[attribute];

    let value = this._attributes[attribute];

    // Apply transform getter if defined
    if (fieldDefinition?.transform?.get) {
      value = fieldDefinition.transform.get(value);
    }

    return value;
  }

  set(attribute: string, value: any): void {
    const definition = (this.constructor as any).definition;
    const fieldDefinition: FieldDefinition = definition.schema?.[attribute];

    // Apply transform setter if defined
    if (fieldDefinition?.transform?.set) {
      value = fieldDefinition.transform.set(value);
    }

    this._attributes[attribute] = value;
  }

  has(attribute: string): boolean {
    return attribute in this._attributes;
  }

  // ========================================================================
  // Dirty Tracking
  // ========================================================================

  isDirty(attribute?: string): boolean {
    if (attribute) {
      return this._attributes[attribute] !== this._original[attribute];
    }

    for (const key in this._attributes) {
      if (this._attributes[key] !== this._original[key]) {
        return true;
      }
    }

    return false;
  }

  isClean(attribute?: string): boolean {
    return !this.isDirty(attribute);
  }

  getDirty(): Record<string, any> {
    const dirty: Record<string, any> = {};

    for (const key in this._attributes) {
      if (this._attributes[key] !== this._original[key]) {
        dirty[key] = this._attributes[key];
      }
    }

    return dirty;
  }

  getChanges(): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};

    for (const key in this._attributes) {
      if (this._attributes[key] !== this._original[key]) {
        changes[key] = {
          old: this._original[key],
          new: this._attributes[key],
        };
      }
    }

    return changes;
  }

  // ========================================================================
  // Serialization
  // ========================================================================

  toJSON(): Record<string, any> {
    return { ...this._attributes };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }

  // ========================================================================
  // Relationships
  // ========================================================================

  async load(relation: string): Promise<void> {
    await this[relation]();
  }

  async loadMultiple(relations: string[]): Promise<void> {
    await Promise.all(relations.map(r => this.load(r)));
  }

  // ========================================================================
  // Validation
  // ========================================================================

  async validate(): Promise<boolean | string[]> {
    const definition = (this.constructor as any).definition;
    const schema = definition.schema || {};
    const errors: string[] = [];

    for (const [field, fieldDef] of Object.entries(schema)) {
      const value = this._attributes[field];
      const def = fieldDef as FieldDefinition;

      // Required validation
      if (def.defaultValue === undefined && (value === undefined || value === null)) {
        errors.push(`${field} is required`);
        continue;
      }

      // Custom validation
      if (def.validate) {
        const result = def.validate(value);
        if (result !== true) {
          errors.push(result || `${field} is invalid`);
        }
      }
    }

    return errors.length > 0 ? errors : true;
  }

  // ========================================================================
  // Hooks
  // ========================================================================

  protected async runHook(hookName: string): Promise<void> {
    const definition = (this.constructor as any).definition;
    const hooks = definition.hooks || {};
    const hook = hooks[hookName];

    if (hook) {
      await hook.call(this, this);
    }
  }

  // ========================================================================
  // Scopes
  // ========================================================================

  static scope(name: string): QueryBuilder {
    const definition = (this as any).definition;
    const scopes = definition.scopes || {};
    const scope = scopes[name];

    if (!scope) {
      throw new Error(`Scope ${name} not defined`);
    }

    return scope(this.query());
  }
}

// ============================================================================
// Relationship Methods
// ============================================================================

export function hasOne(relatedModel: typeof Model, foreignKey: string): () => Promise<any> {
  return async function(this: Model) {
    const primaryKey = (this.constructor as any).definition.primaryKey || 'id';
    const relatedModelInstance = new relatedModel();

    const result = await (relatedModel as any).query()
      .where(foreignKey, '=', this._attributes[primaryKey])
      .first();

    return result;
  };
}

export function hasMany(relatedModel: typeof Model, foreignKey: string): () => Promise<any[]> {
  return async function(this: Model) {
    const primaryKey = (this.constructor as any).definition.primaryKey || 'id';
    const relatedModelInstance = new relatedModel();

    const results = await (relatedModel as any).query()
      .where(foreignKey, '=', this._attributes[primaryKey])
      .get();

    return results;
  };
}

export function belongsTo(relatedModel: typeof Model, foreignKey: string): () => Promise<any> {
  return async function(this: Model) {
    const relatedModelInstance = new relatedModel();

    const result = await (relatedModel as any).query()
      .where(
        (relatedModel as any).definition.primaryKey || 'id',
        '=',
        this._attributes[foreignKey]
      )
      .first();

    return result;
  };
}

export function belongsToMany(
  relatedModel: typeof Model,
  through: string,
  throughForeignKey: string,
  throughLocalKey: string
): () => Promise<any[]> {
  return async function(this: Model) {
    const primaryKey = (this.constructor as any).definition.primaryKey || 'id';
    const adapter = (this.constructor as any).adapter;
    const relatedPrimaryKey = (relatedModel as any).definition.primaryKey || 'id';

    const junctionResults = await adapter.select(through, {
      where: [{ field: throughLocalKey, operator: '=', value: this._attributes[primaryKey] } as QueryCondition],
    });

    if (junctionResults.rowCount === 0) {
      return [];
    }

    const relatedIds = junctionResults.rows.map((r: any) => r[throughForeignKey]);

    if (relatedIds.length === 0) {
      return [];
    }

    const results = await (relatedModel as any).query()
      .whereIn(relatedPrimaryKey, relatedIds)
      .get();

    return results;
  };
}

// ============================================================================
// Decorators for defining models
// ============================================================================

export function Table(tableName: string) {
  return function<T extends { new (...args: any[]): Model }>(constructor: T) {
    (constructor as any).definition = {
      ...((constructor as any).definition || {}),
      tableName,
    };
    return constructor;
  };
}

export function Field(definition: FieldDefinition) {
  return function(target: Model, propertyKey: string) {
    const schema = (target.constructor as any).definition?.schema || {};
    schema[propertyKey] = definition;
    (target.constructor as any).definition = {
      ...((target.constructor as any).definition || {}),
      schema,
    };
  };
}

export function Relation(definition: RelationDefinition) {
  return function(target: Model, propertyKey: string) {
    const relations = (target.constructor as any).definition?.relations || {};
    relations[propertyKey] = definition;
    (target.constructor as any).definition = {
      ...((target.constructor as any).definition || {}),
      relations,
    };
  };
}

// ============================================================================
// Query Scope Decorators
// ============================================================================

export function Scope(name: string) {
  return function(target: Model, propertyKey: string, descriptor: PropertyDescriptor) {
    const scopes = (target.constructor as any).definition?.scopes || {};
    scopes[name] = descriptor.value;
    (target.constructor as any).definition = {
      ...((target.constructor as any).definition || {}),
      scopes,
    };
  };
}
