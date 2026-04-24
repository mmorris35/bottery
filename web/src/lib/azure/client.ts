import { ClientSecretCredential } from "@azure/identity";
import { ContainerAppsAPIClient } from "@azure/arm-appcontainers";
import { ContainerRegistryManagementClient } from "@azure/arm-containerregistry";
import { SecretClient } from "@azure/keyvault-secrets";
import {
  AZURE_SUBSCRIPTION_ID,
  AZURE_KEYVAULT_NAME,
} from "../bottery/config";

let _credential: ClientSecretCredential | null = null;

function getCredential(): ClientSecretCredential {
  if (!_credential) {
    _credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );
  }
  return _credential;
}

let _containerAppsClient: ContainerAppsAPIClient | null = null;

export function getContainerAppsClient(): ContainerAppsAPIClient {
  if (!_containerAppsClient) {
    _containerAppsClient = new ContainerAppsAPIClient(
      getCredential(),
      AZURE_SUBSCRIPTION_ID
    );
  }
  return _containerAppsClient;
}

let _acrClient: ContainerRegistryManagementClient | null = null;

export function getAcrClient(): ContainerRegistryManagementClient {
  if (!_acrClient) {
    _acrClient = new ContainerRegistryManagementClient(
      getCredential(),
      AZURE_SUBSCRIPTION_ID
    );
  }
  return _acrClient;
}

let _kvClient: SecretClient | null = null;

export function getKeyVaultClient(): SecretClient {
  if (!_kvClient) {
    _kvClient = new SecretClient(
      `https://${AZURE_KEYVAULT_NAME}.vault.azure.net`,
      getCredential()
    );
  }
  return _kvClient;
}
