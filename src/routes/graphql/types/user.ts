import {
  GraphQLFloat,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import { profile } from './profile.js';
import { post } from './post.js';

const UserInterface: GraphQLInterfaceType = new GraphQLInterfaceType({
  name: 'Subscriber',
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
