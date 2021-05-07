import { $TSContext, stateManager, getPermissionBoundaryArn, setPermissionBoundaryArn } from 'amplify-cli-core';
import { prompt } from 'inquirer';
import { IAMClient } from '../aws-utils/aws-iam';
import { loadConfiguration } from '../configuration-manager';

export const configurePermissionBoundaryForExistingEnv = async (context: $TSContext) => {
  setPermissionBoundaryArn(await permissionBoundarySupplier(context));
};

export const configurePermissionBoundaryForInit = async (context: $TSContext) => {
  const envName = context.exeInfo.localEnvInfo.envName; // the new environment name
  if (context?.exeInfo?.isNewProject) {
    // amplify init
    // on init flow, set the permission boundary if specified in a cmd line arg, but don't prompt for it
    setPermissionBoundaryArn(
      await permissionBoundarySupplier(context, { doPrompt: false, envNameSupplier: () => envName }),
      envName,
      context.exeInfo.teamProviderInfo,
    );
  } else {
    // amplify env add
    await rolloverPermissionBoundaryToNewEnvironment(context);
  }
};

const permissionBoundarySupplierDefaultOptions = {
  required: false,
  doPrompt: true,
  envNameSupplier: (): string => stateManager.getLocalEnvInfo().envName,
};

/**
 * Supplies a permission boundary ARN by first checking headless parameters, then falling back to a CLI prompt
 * @param context CLI context object
 * @param options Additional options to control the supplier
 * @returns string, the permission boundary ARN or an empty string
 */
const permissionBoundarySupplier = async (
  context: $TSContext,
  options?: Partial<typeof permissionBoundarySupplierDefaultOptions>,
): Promise<string | undefined> => {
  const { required, doPrompt, envNameSupplier } = { ...permissionBoundarySupplierDefaultOptions, ...options };
  const headlessPermissionBoundary = context?.input?.options?.['permission-boundary'];

  const validate = context.amplify.inputValidation({
    operator: 'regex',
    value: '^(|arn:aws:iam::(\\d{12}|aws):policy/.+)$',
    onErrorMsg: 'Specify a valid IAM Policy ARN',
    required: true,
  });

  if (typeof headlessPermissionBoundary === 'string') {
    if (validate(headlessPermissionBoundary)) {
      return headlessPermissionBoundary;
    } else {
      context.print.error('The Permission Boundary ARN specified is not a valid IAM Policy ARN');
    }
  }

  const isYes = context?.input?.options?.yes;
  if (required && (isYes || !doPrompt)) {
    throw new Error('A Permission Boundary ARN must be specified using --permission-boundary');
  }
  if (!doPrompt) {
    // if we got here, the permission boundary is not required and we can't prompt so return undefined
    return;
  }
  const envName = envNameSupplier();
  const { permissionBoundaryArn } = await prompt<{ permissionBoundaryArn: string }>({
    type: 'input',
    name: 'permissionBoundaryArn',
    message: `Specify an IAM Policy ARN to use as a Permission Boundary for all IAM Roles in the ${envName} environment (leave blank to remove the Permission Boundary configuration):`,
    default: getPermissionBoundaryArn(envName),
    validate,
  });
  return permissionBoundaryArn;
};

/**
 * This function expects to be called during the env add flow BEFORE the local-env-info file is overwritten with the new env
 * (ie when it still contains info on the previous env)
 * context.exeInfo.localEnvInfo.envName is expected to have the new env name
 */
const rolloverPermissionBoundaryToNewEnvironment = async (context: $TSContext) => {
  const newEnv = context.exeInfo.localEnvInfo.envName;
  const headlessPermissionBoundary = await permissionBoundarySupplier(context, { doPrompt: false, envNameSupplier: () => newEnv });
  // if headless policy specified, apply that and return
  if (typeof headlessPermissionBoundary === 'string') {
    setPermissionBoundaryArn(headlessPermissionBoundary, newEnv, context.exeInfo.teamProviderInfo);
    return;
  }

  const currBoundary = getPermissionBoundaryArn();
  // if current env doesn't have a permission boundary, do nothing
  if (!currBoundary) {
    return;
  }
  // if existing policy is accessible in new env, apply that one
  if (await isPolicyAccessible(context, currBoundary)) {
    setPermissionBoundaryArn(currBoundary, newEnv, context.exeInfo.teamProviderInfo);
    context.print.info(
      `Permission Boundary ${currBoundary} has automatically been applied to this environment. To modify this, run \`amplify env update\`.`,
    );
    return;
  }
  // if existing policy policy is not accessible in the new environment, prompt for a new one
  context.print.warning(`Permission Boundary ${currBoundary} cannot be applied to resources in this environment.`);
  setPermissionBoundaryArn(
    await permissionBoundarySupplier(context, { required: true, envNameSupplier: () => newEnv }),
    newEnv,
    context.exeInfo.teamProviderInfo,
  );
};

const isPolicyAccessible = async (context: $TSContext, policyArn: string) => {
  const iamClient = await IAMClient.getInstance(context);
  try {
    await iamClient.client.getPolicy({ PolicyArn: policyArn }).promise();
  } catch (err) {
    // if there's an error, then the policy wasn't accessible
    return false;
  }
  return true;
};
