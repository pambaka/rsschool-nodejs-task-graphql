import {
  GraphQLFloat,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLString,
} from 'graphql';
import { profile } from './profile.js';
import { post } from './post.js';

const UserInterface: GraphQLInterfaceType = new GraphQLInterfaceType({
  name: 'UserInterface',
  fields: () => ({
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    subscribedToUser: { type: new GraphQLList(UserInterface) },
    userSubscribedTo: { type: new GraphQLList(UserInterface) },
  }),
  resolveType: () => {
    return user.name;
  },
});

export const user = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: { type: GraphQLString },
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
    profile: { type: profile },
    posts: { type: new GraphQLList(post) },
    subscribedToUser: { type: new GraphQLList(UserInterface) },
    userSubscribedTo: { type: new GraphQLList(UserInterface) },
  },
  interfaces: [UserInterface],
});

const userInputKeys = ['name', 'balance'];

const isValidUserInput = (value: object) => {
  if (userInputKeys.every((key) => key in value)) return true;
  return false;
};

export const createUserInput = new GraphQLScalarType({
  name: 'CreateUserInput',
  parseValue(value) {
    if (value && typeof value === 'object' && isValidUserInput(value)) return value;

    if (typeof value === 'string') {
      const user = JSON.parse(value) as object;
      if (isValidUserInput(user)) return user;
    }

    throw new Error(
      `Invalid input. Some of the required keys (${userInputKeys.join(', ')}) are missing.`,
    );
  },
});

export const changeUserInput = new GraphQLScalarType({
  name: 'ChangeUserInput',
});

export const subscriber = new GraphQLScalarType({
  name: 'Subscriber',
});
