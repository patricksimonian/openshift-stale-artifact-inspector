#!/usr/bin/env bash
set -Eeu
#set -o pipefail

NAMESPACES=''
#APP=''
#PR=1
for i in "$@"
do
case $i in
    --namespaces=*)
    NAMESPACES="${i#*=}"
    shift # past argument=value
    ;;
    --pr=*)
    PR="${i#*=}"
    shift # past argument=value
    ;;
    --app=*)
    APP="${i#*=}"
    shift # past argument=value
    ;;
    *)
    # unknown option
    ;;
esac
done


IFS=","
for NAMESPACE in $NAMESPACES; do
  SELECTOR="env-id=pr-${PR},app-name=${APP},env-name!=prod,env-name!=test"
  #echo "SELECTOR:${SELECTOR}"
  #set -x

  # Delete tags produced by buildConfig
  while read tag; do
    set -x
    oc -n $NAMESPACE tag "$tag" -d || true
    { set +x; } 2>/dev/null
  done < <(oc -n $NAMESPACE get buildconfigs -l "$SELECTOR" -o json | jq -cMr '.items[].spec.output.to | select (. != null) | .name' | sort | uniq)
  
  #Delete tags used by DeploymentConfig
  while read tag; do
    set -x
    oc -n $NAMESPACE tag "$tag" -d || true
    { set +x; } 2>/dev/null
  done < <(oc -n $NAMESPACE get deploymentconfigs -l "$SELECTOR" -o json | jq -cMr '.items[].spec.triggers[] | select(.type == "ImageChange") | .imageChangeParams.from.name' | sort | uniq)

  set -x
  oc -n $NAMESPACE delete all -l "$SELECTOR"
  oc -n $NAMESPACE delete 'PersistentVolumeClaim,Secret,ConfigMap,RoleBinding' -l "$SELECTOR"
  { set +x; } 2>/dev/null
done

unset IFS
