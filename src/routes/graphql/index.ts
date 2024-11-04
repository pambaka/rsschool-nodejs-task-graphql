import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  parse,
  validate,
} from 'graphql';
import { memberType, memberTypeId } from './types/memberType.js';
import { changePostInput, createPostInput, post } from './types/post.js';
import {
  changeUserInput,
  createUserInput,
  subscriber,
  user,
  UserWithSubs,
} from './types/user.js';
import { changeProfileInput, createProfileInput, profile } from './types/profile.js';
import { UUIDType } from './types/uuid.js';
import { MemberType, Post, Profile, User } from '@prisma/client';
import depthLimit from 'graphql-depth-limit';
import DataLoader from 'dataloader';
import { Context } from './types/context.js';

let keys: string[] = [];

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req) {
      const source = req.body.query;
      const document = parse(req.body.query);

      const maxQueryDepth = 5;
      const errors = validate(schema, document, [depthLimit(maxQueryDepth)]);

      if (errors.length !== 0)
        return {
          errors: [
            {
              message: `Query depth exceeds maximum operation depth of ${maxQueryDepth}`,
            },
          ],
        };

      const users = await prisma.user.findMany({
        include: { subscribedToUser: true, userSubscribedTo: true },
      });
      keys = users.map((user) => user.id);
      const userLoader: DataLoader<
        unknown,
        Promise<UserWithSubs | UserWithSubs[] | undefined>
      > = new DataLoader(async (key) => {
        return key.map(async (key) => users.find((user) => user.id === key));
      });

      const profileLoader: DataLoader<
        unknown,
        Promise<Profile | undefined>
      > = new DataLoader(async (keys) => {
        const profiles = await prisma.profile.findMany();
        return keys.map(async (key) =>
          profiles.find((profile) => profile.userId === key),
        );
      });

      const postLoader: DataLoader<unknown, Promise<Post[] | undefined>> = new DataLoader(
        async (keys) => {
          const posts = await prisma.post.findMany();
          return keys.map(async (key) => posts.filter((post) => post.authorId === key));
        },
      );

      const memberTypeLoader: DataLoader<
        unknown,
        Promise<MemberType | undefined>
      > = new DataLoader(async (keys) => {
        const memberTypes = await prisma.memberType.findMany();
        return keys.map(async (key) => memberTypes.find((mType) => mType.id === key));
      });

      return graphql({
        schema,
        source,
        variableValues: req.body.variables,
        contextValue: { userLoader, profileLoader, postLoader, memberTypeLoader },
      });
    },
  });

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQuery',
      fields: {
        memberTypes: {
          type: new GraphQLList(memberType),
          resolve: async () => {
            return await prisma.memberType.findMany();
          },
        },
        memberType: {
          args: { id: { type: memberTypeId } },
          type: memberType,
          resolve: async (_, args: { id: string }) => {
            return await prisma.memberType.findUnique({ where: { id: args.id } });
          },
        },

        posts: {
          type: new GraphQLList(post),
          resolve: async () => {
            return await prisma.post.findMany();
          },
        },
        post: {
          args: { id: { type: UUIDType } },
          type: post,
          resolve: (_, args: { id: string }) => {
            return prisma.post.findUnique({ where: { id: args.id } });
          },
        },

        users: {
          type: new GraphQLList(user),
          resolve: async (_, arg, context: Context) => {
            const users = (await context.userLoader.loadMany(keys)) as UserWithSubs[];

            return users.map(async (args) => {
              return await getUser(args.id, users, context);
            });
          },
        },
        user: {
          args: { id: { type: UUIDType } },
          type: user,
          resolve: async (_, args: { id: string }, context: Context) => {
            const users = (await context.userLoader.loadMany(keys)) as UserWithSubs[];
            return await getUser(args.id, users, context);
          },
        },

        profiles: {
          type: new GraphQLList(profile),
          resolve: async () => {
            return await prisma.profile.findMany();
          },
        },
        profile: {
          args: { id: { type: UUIDType } },
          type: profile,
          resolve: async (_, args: { id: string }) => {
            return await prisma.profile.findUnique({ where: { id: args.id } });
          },
        },
      },
    }),

    mutation: new GraphQLObjectType({
      name: 'RootMutation',
      fields: {
        createUser: {
          args: { dto: { type: createUserInput } },
          type: user,
          resolve: async (_, args: { dto: User }) => {
            return await prisma.user.create({ data: { ...args.dto } });
          },
        },
        changeUser: {
          args: {
            id: { type: UUIDType },
            dto: { type: changeUserInput },
          },
          type: user,
          resolve: async (_, args: { id: string; dto: User }) => {
            return await prisma.user.update({
              where: { id: args.id },
              data: { ...args.dto },
            });
          },
        },
        deleteUser: {
          args: { id: { type: UUIDType } },
          type: new GraphQLScalarType({ name: 'DeletedUser' }),
          resolve: async (_, args: { id: string }) => {
            return await prisma.user.delete({ where: { id: args.id } });
          },
        },

        createPost: {
          args: { dto: { type: createPostInput } },
          type: post,
          resolve: async (_, args: { dto: Post }) => {
            return await prisma.post.create({ data: { ...args.dto } });
          },
        },
        changePost: {
          args: {
            id: { type: UUIDType },
            dto: { type: changePostInput },
          },
          type: post,
          resolve: async (_, args: { id: string; dto: Post }) => {
            return await prisma.post.update({
              where: { id: args.id },
              data: { ...args.dto },
            });
          },
        },
        deletePost: {
          args: { id: { type: UUIDType } },
          type: new GraphQLScalarType({ name: 'DeletedPost' }),
          resolve: async (_, args: { id: string }) => {
            return await prisma.post.delete({ where: { id: args.id } });
          },
        },

        createProfile: {
          args: { dto: { type: createProfileInput } },
          type: profile,
          resolve: async (_, args: { dto: Profile }) => {
            return await prisma.profile.create({ data: { ...args.dto } });
          },
        },
        changeProfile: {
          args: {
            id: { type: UUIDType },
            dto: { type: changeProfileInput },
          },
          type: profile,
          resolve: async (_, args: { id: string; dto: Profile }) => {
            if (args.id && args.dto.userId && args.id !== args.dto.userId)
              throw new Error(`Invalid userId`);
            return await prisma.profile.update({
              where: { id: args.id },
              data: { ...args.dto },
            });
          },
        },
        deleteProfile: {
          args: { id: { type: UUIDType } },
          type: new GraphQLScalarType({ name: 'DeletedProfile' }),
          resolve: async (_, args: { id: string }) => {
            return await prisma.profile.delete({ where: { id: args.id } });
          },
        },

        subscribeTo: {
          args: {
            userId: { type: UUIDType },
            authorId: { type: UUIDType },
          },
          type: subscriber,
          resolve: async (_, args: { userId: string; authorId: string }) => {
            return await prisma.subscribersOnAuthors.create({
              data: { authorId: args.authorId, subscriberId: args.userId },
            });
          },
        },
        unsubscribeFrom: {
          args: {
            userId: { type: UUIDType },
            authorId: { type: UUIDType },
          },
          type: subscriber,
          resolve: async (_, args: { userId: string; authorId: string }) => {
            return await prisma.subscribersOnAuthors.delete({
              where: {
                subscriberId_authorId: {
                  authorId: args.authorId,
                  subscriberId: args.userId,
                },
              },
            });
          },
        },
      },
    }),
  });
};

async function getUser(id: string, users: UserWithSubs[], context: Context) {
  const userProfile = await context.profileLoader.load(id);

  const userMemberType = userProfile
    ? await context.memberTypeLoader.load(userProfile.memberTypeId)
    : null;

  const userPosts = await context.postLoader.load(id);

  const subscribers = (await getSubscribers(id, users)) ?? [];
  const subscribersWithSubscription = subscribers.map(async (sub) => {
    const subscriptions = await getSubscriptions(sub.id, users);
    return { ...sub, userSubscribedTo: subscriptions ?? [] };
  });

  const subscriptions = (await getSubscriptions(id, users)) ?? [];
  const subscriptionsWithSubscribers = subscriptions.map(async (sub) => {
    const subscribers = await getSubscribers(sub.id, users);
    return { ...sub, subscribedToUser: subscribers ?? [] };
  });

  const user = await context.userLoader.load(id);

  if (!user) return null;

  return {
    ...user,
    profile: userProfile ? { ...userProfile, memberType: userMemberType } : null,
    posts: userPosts ?? [],
    subscribedToUser: subscribersWithSubscription ?? [],
    userSubscribedTo: subscriptionsWithSubscribers ?? [],
  };
}

async function getSubscriptions(id: string, users: UserWithSubs[]) {
  return users.filter((user) => {
    return user.subscribedToUser.some((sub) => sub.subscriberId === id);
  });
}

async function getSubscribers(id: string, users: UserWithSubs[]) {
  return users.filter((user) => {
    return user.userSubscribedTo.some((sub) => sub.authorId === id);
  });
}

export default plugin;
