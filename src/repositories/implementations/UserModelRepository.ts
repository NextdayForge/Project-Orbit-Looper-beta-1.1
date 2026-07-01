import { LooperDataStore } from '../../storage/LooperDataStore';
import { UserModel, createDefaultUserModel } from '../../types/userModel';
import { IUserModelRepository } from '../interfaces/IUserModelRepository';
import { migrateUserModelBufferNeed } from '../migrations/migrateUserModelBufferNeed';

function deepCloneUserModel(userModel: UserModel): UserModel {
  if (typeof structuredClone === 'function') {
    return structuredClone(userModel);
  }
  return JSON.parse(JSON.stringify(userModel)) as UserModel;
}

export class UserModelRepository implements IUserModelRepository {
  constructor(private readonly store: LooperDataStore) {}

  async get(): Promise<UserModel> {
    const data = await this.store.load();
    const userModel = migrateUserModelBufferNeed(deepCloneUserModel(data.userModel));

    if (userModel.bufferNeed !== data.userModel.bufferNeed) {
      await this.save(userModel);
    }

    return userModel;
  }

  async save(userModel: UserModel): Promise<UserModel> {
    const normalized = migrateUserModelBufferNeed(userModel);

    await this.store.mutate(
      (data) => {
        data.userModel = normalized;
      },
      { immediate: true }
    );
    return normalized;
  }

  async reset(): Promise<UserModel> {
    const fresh = createDefaultUserModel();
    await this.store.mutate(
      (data) => {
        data.userModel = fresh;
      },
      { immediate: true }
    );
    return fresh;
  }
}
