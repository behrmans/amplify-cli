import { InvalidDirectiveError } from '@aws-amplify/graphql-transformer-core';
import { AuthRule, ConfiguredAuthProviders } from './definitions';

export const validateRuleAuthStrategy = (rule: AuthRule, configuredAuthProviders: ConfiguredAuthProviders) => {
  //
  // Groups
  //
  if (rule.allow === 'groups' && rule.provider !== 'userPools' && rule.provider !== 'oidc') {
    throw new InvalidDirectiveError(
      `@auth directive with 'groups' strategy only supports 'userPools' and 'oidc' providers, but found '${rule.provider}' assigned.`,
    );
  }

  //
  // Owner
  //
  if (rule.allow === 'owner') {
    if (rule.provider !== null && rule.provider !== 'userPools' && rule.provider !== 'oidc') {
      throw new InvalidDirectiveError(
        `@auth directive with 'owner' strategy only supports 'userPools' (default) and 'oidc' providers, but \
found '${rule.provider}' assigned.`,
      );
    }
  }

  //
  // Public
  //
  if (rule.allow === 'public') {
    if (rule.provider !== null && rule.provider !== 'apiKey' && rule.provider !== 'iam') {
      throw new InvalidDirectiveError(
        `@auth directive with 'public' strategy only supports 'apiKey' (default) and 'iam' providers, but \
found '${rule.provider}' assigned.`,
      );
    }
  }

  //
  // Private
  //
  if (rule.allow === 'private') {
    if (rule.provider !== null && rule.provider !== 'userPools' && rule.provider !== 'iam') {
      throw new InvalidDirectiveError(
        `@auth directive with 'private' strategy only supports 'userPools' (default) and 'iam' providers, but \
found '${rule.provider}' assigned.`,
      );
    }
  }

  //
  // Validate provider values against project configuration.
  //
  if (rule.provider === 'apiKey' && configuredAuthProviders.hasApiKey === false) {
    throw new InvalidDirectiveError(
      `@auth directive with 'apiKey' provider found, but the project has no API Key authentication provider configured.`,
    );
  } else if (rule.provider === 'oidc' && configuredAuthProviders.hasOIDC === false) {
    throw new InvalidDirectiveError(
      `@auth directive with 'oidc' provider found, but the project has no OPENID_CONNECT authentication provider configured.`,
    );
  } else if (rule.provider === 'userPools' && configuredAuthProviders.hasUserPools === false) {
    throw new InvalidDirectiveError(
      `@auth directive with 'userPools' provider found, but the project has no Cognito User Pools authentication provider configured.`,
    );
  } else if (rule.provider === 'iam' && configuredAuthProviders.hasIAM === false) {
    throw new InvalidDirectiveError(
      `@auth directive with 'iam' provider found, but the project has no IAM authentication provider configured.`,
    );
  }
};

export const validateRules = (rules: AuthRule[], configuredAuthProviders: ConfiguredAuthProviders) => {
  for (const rule of rules) {
    validateRuleAuthStrategy(rule, configuredAuthProviders);

    const { queries, mutations, operations } = rule;
    if (mutations && operations) {
      console.warn(`It is not recommended to use 'mutations' and 'operations'. The 'operations' argument will be used.`);
    }
    if (queries && operations) {
      console.warn(`It is not recommended to use 'queries' and 'operations'. The 'operations' argument will be used.`);
    }
    commonRuleValidation(rule);
  }
};

export const validateFieldRules = (
  rules: AuthRule[],
  isParentTypeBuiltinType: boolean,
  parentHasModelDirective: boolean,
  authProviderConfig: ConfiguredAuthProviders,
) => {
  for (const rule of rules) {
    validateRuleAuthStrategy(rule, authProviderConfig);

    const { queries, mutations } = rule;
    if (queries || mutations) {
      throw new InvalidDirectiveError(
        `@auth directives used on field definitions may not specify the 'queries' or 'mutations' arguments. \
All @auth directives used on field definitions are performed when the field is resolved and can be thought of as 'read' operations.`,
      );
    }

    if (isParentTypeBuiltinType && rule.operations && rule.operations.length > 0) {
      throw new InvalidDirectiveError(
        `@auth rules on fields within Query, Mutation, Subscription cannot specify 'operations' argument as these rules \
are already on an operation already.`,
      );
    }

    if (!parentHasModelDirective && rule.operations && rule.operations.length > 0) {
      throw new InvalidDirectiveError(
        `@auth rules on fields within types that does not have @model directive cannot specify 'operations' argument as there are \
operations will be generated by the CLI.`,
      );
    }

    commonRuleValidation(rule);
  }
};

// commmon rule validation between obj and field
export const commonRuleValidation = (rule: AuthRule) => {
  const { identityClaim, allow, groups, groupsField, groupClaim } = rule;
  if (allow === 'groups' && identityClaim) {
    throw new InvalidDirectiveError(`
          @auth identityClaim can only be used for 'allow: owner'`);
  }
  if (allow === 'owner' && groupClaim) {
    throw new InvalidDirectiveError(`
          @auth groupClaim can only be used 'allow: groups'`);
  }
  if (groupsField && groups) {
    throw new InvalidDirectiveError('This rule has groupsField and groups, please use one or the other');
  }
};
