import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import {
  graphql,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import { memberType } from './types/memberType.js';
import { post } from './types/post.js';
import { user } from './types/user.js';
import { profile } from './types/profile.js';

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
          args: {
            id: { type: GraphQLString },
          },
          type: memberType,
          resolve: async (_, args: { id: string }) => {
            if (args.id)
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
          args: {
            id: { type: GraphQLString },
          },
          type: post,
          resolve: (_, args: { id: string }) => {
            return prisma.post.findUnique({ where: { id: args.id } });
          },
        },

        users: {
          type: new GraphQLList(user),
          resolve: async () => {
            return await prisma.user.findMany();
          },
        },
        user: {
          args: {
            id: { type: GraphQLString },
          },
          type: user,
          resolve: async (_, args: { id: string }) => {
            if (args.id) return await prisma.user.findUnique({ where: { id: args.id } });
          },
        },

        profiles: {
          type: new GraphQLList(profile),
          resolve: async () => {
            return await prisma.profile.findMany();
          },
        },
        profile: {
          args: {
            id: { type: GraphQLString },
          },
          type: profile,
          resolve: async (_, args: { id: string }) => {
            return await prisma.profile.findUnique({ where: { id: args.id } });
          },
        },
      },
    }),
  });
};

export default plugin;
