#!/bin/bash

set -e

PLATFORM=$1
CLEAN=$2

PROJ=cordova-test
DIR=~/projects/$PROJ
PLUGIN_PATH=~/git/cordova-plugin-nabto
PLUGIN_TEST_PATH=~/git/cordova-plugin-nabto-tests

# patch plugin with source from these locations if they exist
OPTIONAL_IOS_CLIENT_PATH=~/svn/trunk/nabto/src/app/client/ios2.0/NabtoClient/NabtoClient
OPTIONAL_ANDROID_CLIENT_PATH=~/git/android-client-api/src/main/java/com/nabto/api

if [ -z "$PLATFORM" ]; then
   echo "Usage: $0 <platform> [clean]"
   exit 1
fi

if [ ! -z "$CLEAN" ]; then
    rm -rf $DIR
fi

function createProject() {
    local id=`echo $PROJ | sed 's/[-_]//'`
    time {
        rm -rf $DIR
        mkdir $DIR
        cd $DIR
        cordova create $DIR com.example.$id $PROJ
        cordova plugin add https://github.com/maverickmishra/cordova-plugin-test-framework.git
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
    echo "Uninstalling plugins"
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

function installPlugins() {
    if [ "$platform" == "ios" ]; then
        if [ -d $OPTIONAL_IOS_CLIENT_PATH ]; then
            echo "Patching iOS plugin with source from $OPTIONAL_IOS_CLIENT_PATH"
            cp $OPTIONAL_IOS_CLIENT_PATH/NabtoClient.{h,mm} $PLUGIN_PATH/src/ios
        fi
    fi

    if [ "$platform" == "android" ]; then
        if [ -d $OPTIONAL_ANDROID_CLIENT_PATH ]; then
            echo "Patching Android plugin with source from $OPTIONAL_ANDROID_CLIENT_PATH"
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
    
    if [ "$platform" == "ios" ]; then
        echo 'OTHER_LDFLAGS = -force_load $(BUILT_PRODUCTS_DIR)/libCordova.a -lstdc++' >> platforms/ios/cordova/build.xcconfig
    fi
}

function buildAndRun() {

    if [ ! -d $DIR ]; then
        createProject
    fi
    cd $DIR
    
    if [[ "$(isPlatformInstalled $PLATFORM)" != "1" ]]; then
        echo "$PLATFORM missing, adding"
        time {
            cordova platform add $PLATFORM@latest
        }
        if [ "$PLATFORM" == "ios" ]; then
            # work around replace bug
            PWD=`pwd`
            cd $PWD/platforms/ios/cordova
            npm install ios-sim@latest
            cd $PWD
        fi
    fi
    
    uninstallPlugins
    installPlugins
    
    cordova build --emulator $PLATFORM 
    cordova emulate $PLATFORM
}

time {
    buildAndRun
}
