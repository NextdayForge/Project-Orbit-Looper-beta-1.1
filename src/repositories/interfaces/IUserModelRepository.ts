import { UserModel } from '../../types/userModel';

export interface IUserModelRepository {
  get(): Promise<UserModel>;
  save(userModel: UserModel): Promise<UserModel>;
  reset(): Promise<UserModel>;
}
