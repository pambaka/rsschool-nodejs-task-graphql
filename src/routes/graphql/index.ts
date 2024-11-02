import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
} from 'graphql';
import { memberType, memberTypeId } from './types/memberType.js';
import { changePostInput, createPostInput, post } from './types/post.js';
import { changeUserInput, createUserInput, user } from './types/user.js';
import { changeProfileInput, createProfileInput, profile } from './types/profile.js';
import { UUIDType } from './types/uuid.js';
import { Post, PrismaClient, Profile, User } from '@prisma/client';

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
      return graphql({
        schema,
        source: req.body.query,
        variableValues: req.body.variables,
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
          resolve: async () => {
            const users = (await prisma.user.findMany()).map(async (args) => {
              return await getUser(prisma, args.id);
            });

            return users;
          },
        },
        user: {
          args: { id: { type: UUIDType } },
          type: user,
          resolve: async (_, args: { id: string }) => {
            return await getUser(prisma, args.id);
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
      },
    }),
  });
};

async function getUser(prisma: PrismaClient, id: string) {
  const userProfile = await prisma.profile.findUnique({ where: { userId: id } });

  const userMemberType = userProfile
    ? await prisma.memberType.findUnique({ where: { id: userProfile.memberTypeId } })
    : null;

  const userPosts = await prisma.post.findMany({ where: { authorId: id } });

  const subscribers = await getSubscribers(prisma, id);
  const subscribersWithSubscription = subscribers.map(async (sub) => {
    const subscriptions = await getSubscriptions(prisma, sub.id);
    return { ...sub, userSubscribedTo: subscriptions ?? [] };
  });

  const subscriptions = await getSubscriptions(prisma, id);
  const subscriptionsWithSubscribers = subscriptions.map(async (sub) => {
    const subscribers = await getSubscribers(prisma, sub.id);
    return { ...sub, subscribedToUser: subscribers ?? [] };
  });

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) return null;

  return {
    ...user,
    profile: userProfile ? { ...userProfile, memberType: userMemberType } : null,
    posts: userPosts ?? [],
    subscribedToUser: subscribersWithSubscription ?? [],
    userSubscribedTo: subscriptionsWithSubscribers ?? [],
  };
}

async function getSubscriptions(prisma: PrismaClient, id: string) {
  return await prisma.user.findMany({
    where: { subscribedToUser: { some: { subscriberId: id } } },
  });
}

async function getSubscribers(prisma: PrismaClient, id: string) {
  return await prisma.user.findMany({
    where: { userSubscribedTo: { some: { authorId: id } } },
  });
}

export default plugin;
