Here's an improved README with clear comments and explanations for each step:

```markdown
# Azure Kubernetes Service (AKS) Deployment Guide

This document provides step-by-step instructions to deploy a Kubernetes cluster on Azure with ingress controller and horizontal pod autoscaling.

## Prerequisites
- Azure CLI installed (`az`)
- kubectl installed
- Appropriate Azure permissions

## 🔐 Azure Login and Setup

```bash
# Authenticate with Azure
az login

# Set the active Azure subscription (replace with your ID)
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"

# Create a resource group for your resources
az group create --name demand-rg --location centralindia
```

## 🚀 AKS Cluster Creation

```bash
# Create AKS cluster with 2 nodes and monitoring
az aks create \
  --resource-group demand-rg \
  --name demand-cluster \
  --node-count 2 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials to access the cluster with kubectl
az aks get-credentials --resource-group demand-rg --name demand-cluster

# Verify nodes are running
kubectl get nodes
```

## 🌐 Ingress Controller Setup

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.0/deploy/static/provider/cloud/deploy.yaml

# Check ingress service (wait for EXTERNAL-IP to be assigned)
kubectl get svc -n ingress-nginx
```

## 📦 Application Deployment

```bash
# Apply Kubernetes manifests (assuming you have these files in k8s/ directory)
kubectl apply -f k8s/secret.yaml        # For sensitive configuration
kubectl apply -f k8s/deployment.yaml    # Your application deployment
kubectl apply -f k8s/service.yaml       # Service exposure
kubectl apply -f k8s/ingress.yaml       # Ingress rules
kubectl apply -f k8s/hpa.yaml           # Autoscaling configuration

# Verify ingress is properly configured
kubectl get ingress
```


