import {
  GraphQLBoolean,
  GraphQLInt,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLString,
} from 'graphql';
import { memberType } from './memberType.js';

export const profile = new GraphQLObjectType({
  name: 'Profile',
  fields: {
    id: { type: GraphQLString },
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    userId: { type: GraphQLString },
    memberTypeId: { type: GraphQLString },
    memberType: { type: memberType },
  },
});

const profileInputKeys = ['userId', 'isMale', 'yearOfBirth', 'memberTypeId'];

const isValidProfileInput = (value: object) => {
  if (!profileInputKeys.every((key) => key in value))
    throw new Error(
      `Invalid input. Some of the required keys (${profileInputKeys.join(', ')}) are missing.`,
    );

  if ('yearOfBirth' in value && typeof value.yearOfBirth === 'number') {
    const year = value.yearOfBirth;
    if (year === parseInt(String(year))) return true;
    else throw new Error(`yearOfBirts: Int cannot represent non-integer value: ${year}`);
  }
};

export const createProfileInput = new GraphQLScalarType({
  name: 'CreateProfileInput',
  parseValue(value) {
    if (value && typeof value === 'object' && isValidProfileInput(value)) return value;

    if (typeof value === 'string') {
      const profile = JSON.parse(value) as object;
      if (isValidProfileInput(profile)) return profile;
    }

    throw new Error(
      `Invalid input. Some of the required keys (${profileInputKeys.join(',')}) are missing.`,
    );
  },
});
