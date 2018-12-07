#!/bin/bash

set -e

PLATFORM=$1
TARGET=$2

PROJ=cordova-test
DIR=~/projects/$PROJ-2
PLUGIN_PATH=~/git/cordova-plugin-nabto
PLUGIN_TEST_PATH=~/git/cordova-plugin-nabto-tests

# patch plugin with source from these locations if they exist
OPTIONAL_IOS_CLIENT_PATH=~/git/nabto-ios-client/NabtoClient_IGNORE
OPTIONAL_ANDROID_CLIENT_PATH=~/git/android-client-api/src/main/java/com/nabto/api

if [ -z "$PLATFORM" ]; then
   echo "Usage: $0 <platform> [nuke|npm|<tar ball from jenkins>]"
   exit 1
fi

if [ "$PLATFORM" == "android" ]; then
    VERSION=6.3.0
else
    VERSION=latest
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
#        cordova plugin add http://git-wip-us.apache.org/repos/asf/cordova-plugin-test-framework.git
        cordova plugin add https://github.com/apache/cordova-plugin-test-framework
#        cordova plugin add https://github.com/maverickmishra/cordova-plugin-test-framework.git
        cordova plugin add cordova-plugin-device
        cordova plugin add cordova-plugin-file
	npm install android-versions --save
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
        pwd
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
        time {
            cordova platform add $PLATFORM@$VERSION
        }
        if [ "$PLATFORM" == "ios" ]; then
            # work around replace bug
            pushd . > /dev/null
            cd platforms/ios/cordova
            npm install ios-sim@latest
            popd > /dev/null
        fi
    fi

    uninstallPlugins
    installPlugins
    
    
    if [ "$PLATFORM" == "ios" ]; then
        cordova --buildFlag='-UseModernBuildSystem=0' build --emulator $PLATFORM
        cordova run ios --buildFlag='-UseModernBuildSystem=0' --target iPad-Air-2
    else
        cordova build --emulator $PLATFORM
        cordova emulate $PLATFORM
    fi
}

time {
    buildAndRun
}
