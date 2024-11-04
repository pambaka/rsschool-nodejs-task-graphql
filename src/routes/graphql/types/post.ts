import { GraphQLObjectType, GraphQLScalarType, GraphQLString } from 'graphql';

export const post = new GraphQLObjectType({
  name: 'Post',
  fields: {
    id: { type: GraphQLString },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    authorId: { type: GraphQLString },
  },
});

const postInputKeys = ['authorId', 'title', 'content'];

const isValidPostInput = (value: object) => {
  if (postInputKeys.every((key) => key in value)) return true;
  return false;
};

export const createPostInput = new GraphQLScalarType({
  name: 'CreatePostInput',
  parseValue(value) {
    if (value && typeof value === 'object' && isValidPostInput(value)) return value;

    if (typeof value === 'string') {
      const post = JSON.parse(value) as object;
      if (isValidPostInput(post)) return post;
    }

    throw new Error(
      `Invalid input. Some of the required keys (${postInputKeys.join(', ')}) are missing.`,
    );
  },
});

export const changePostInput = new GraphQLScalarType({
  name: 'ChangePostInput',
});
