import DataLoader from 'dataloader';
import { UserWithSubs } from './user.js';
import { MemberType, Post, Profile } from '@prisma/client';

export type Context = {
  userLoader: DataLoader<unknown, UserWithSubs | UserWithSubs[] | undefined>;
  profileLoader: DataLoader<unknown, Profile | undefined>;
  postLoader: DataLoader<unknown, Post[] | undefined>;
  memberTypeLoader: DataLoader<unknown, MemberType | undefined>;
};
