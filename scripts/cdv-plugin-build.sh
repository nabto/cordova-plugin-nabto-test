#!/bin/bash
PLUGIN_TEST_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
echo $PLUGIN_TEST_PATH

set -e

PLATFORM=$1
TARGET=$2

PROJ=cordova-test
DIR=~/Documents/$PROJ
PLUGIN_PATH=~/sandbox/cordova-plugin-nabto

if [[ -z "${PLUGIN_PATH}" ]]; then
    echo "PLUGIN_PATH unset"
    exit 1;
fi;

# patch plugin with source from these locations if they exist
OPTIONAL_IOS_CLIENT_PATH=~/sandbox/nabto/src/app/client/ios2.0/NabtoClient/NabtoClient
OPTIONAL_ANDROID_CLIENT_PATH=~/sandbox/android-client-api/src/main/java/com/nabto/api

if [ -z "$PLATFORM" ]; then
   echo "Usage: $0 <platform> [clean|npm|<tar ball from jenkins>]"
   exit 1
fi

if [ ! -z "$TARGET" ]; then
    rm -rf $DIR
fi

function createProject() {
    local id=`echo $PROJ | sed 's/[-_]//'`
    time {
        rm -rf $DIR
        mkdir -p $DIR
        cd $DIR
        cordova create $DIR com.example.$id $PROJ
        cordova plugin add https://github.com/maverickmishra/cordova-plugin-test-framework.git
        cordova plugin add cordova-plugin-device
        cordova plugin add cordova-plugin-file
        local f=`mktemp`
        cat $DIR/config.xml | sed 's/index.html/cdvtests\/index.html/' > $f
        cp $f $DIR/config.xml
        rm $f
        
    }
}

function isPlatformInstalled() {
    local plat=$1
    for p in `cordova platform ls`; do
        if [ "$p" == "$plat" ]; then
            echo 1
            return
        fi
        if [ "$p" == "Available" ]; then
            echo 0
            return 
        fi
    done
}

function uninstallPlugins() {
    echo "Uninstalling Nabto plugins"
    set +e
    time {
        rm -rf  ~/.npm/cordova-plugin-nabto*
        cordova plugin ls | grep -q nabto
        if [ $? == 0 ]; then
            npm uninstall cordova-plugin-nabto-tests 
            npm uninstall cordova-plugin-nabto
            cordova plugin rm cordova-plugin-nabto-tests
            cordova plugin rm cordova-plugin-nabto
        fi
    }
    set -e
}

function installDevPlugins() {    
    if [ "$PLATFORM" == "ios" ]; then
        if [ -d $OPTIONAL_IOS_CLIENT_PATH ]; then
            echo "Patching iOS plugin with source from $OPTIONAL_IOS_CLIENT_PATH"
            cp $OPTIONAL_IOS_CLIENT_PATH/NabtoClient.{h,mm} $PLUGIN_PATH/src/ios
        fi
    fi

    if [ "$PLATFORM" == "android" ]; then
        if [ -d $OPTIONAL_ANDROID_CLIENT_PATH ]; then
            echo "Patching Android plugin with source from $OPTIONAL_ANDROID_CLIENT_PATH"
            echo "********************************************************************************"
            echo "Remember to disable .aar install in plugin.xml!"
            echo "********************************************************************************"
            pushd . > /dev/null
            cd $PLUGIN_PATH/src/android
            rm -rf api
            cp -R $OPTIONAL_ANDROID_CLIENT_PATH .
            popd > /dev/null
        fi
    fi

    echo "Installing plugins"
    time {
        cordova plugin add $PLUGIN_PATH
        cordova plugin add $PLUGIN_TEST_PATH
    }
    
    if [ "$PLATFORM" == "ios" ]; then
        echo 'OTHER_LDFLAGS = -force_load $(BUILT_PRODUCTS_DIR)/libCordova.a -lstdc++' >> platforms/ios/cordova/build.xcconfig
    fi
}

function installNpmPlugins() {
    cordova plugin add cordova-plugin-nabto
    cordova plugin add https://github.com/nabto/cordova-plugin-nabto-test.git
}

function installTarballPlugins() {
    # cordova expects github tarball format, not the one output by Nabto jenkins, so unpack and install from dir
    local tmpdir=`mktemp -d`
    pushd . > /dev/null
    cd $tmpdir
    tar xfz $TARGET
    if [ ! -d $tmpdir/package ]; then
        echo "ERROR: Unexpected package structure"
        rm -rf $tmpdir
        exit 1
    fi
    popd > /dev/null
    cordova plugin add $tmpdir/package
    cordova plugin add https://github.com/nabto/cordova-plugin-nabto-test.git
    rm -rf $tmpdir
}

function installPlugins() {
    if [ "$TARGET" == "npm" ]; then
        installNpmPlugins
    elif [ -f "$TARGET" ]; then
        installTarballPlugins
    else
        installDevPlugins
    fi
                
}

function buildAndRun() {

    if [ ! -d $DIR ]; then
        createProject
    fi
    cd $DIR
    
    if [[ "$(isPlatformInstalled $PLATFORM)" != "1" ]]; then
        echo "$PLATFORM missing, adding"
        if [ "$PLATFORM" == "ios" ]; then
            time {
                cordova platform add $PLATFORM@latest
            }
            # work around replace bug
            PWD=`pwd`
            cd $PWD/platforms/ios/cordova
            npm install ios-sim@latest
            cd $PWD
        else
            time {
                # Work around for Apache failing to maintain cordova-plugin-test-framework
                # Going to android 6.4.0 currently fails
                cordova platform add $PLATFORM@6.3.0
            }
        fi
    fi
    
    uninstallPlugins
    installPlugins
    
    cordova build $PLATFORM
    
    if [ "$PLATFORM" == "ios" ]; then
        cordova run ios --target iPad-Air-2
    else
        cordova run $PLATFORM
    fi
}

time {
    buildAndRun
}
