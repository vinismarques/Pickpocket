function addOrArchivePage(tab) {
    var item = getItemByUrl(tab.url);
    if (item && item.state == '0') {
        item.tabId = tab.id;
        var messageText = {
            'true'  : 'Page archived.',
            'false' : 'There was a problem. Page not archived.'
        };
        markItemRead(item, function () {
            chrome.tabs.sendMessage(tab.id, {
                name : 'archiveResult',
                data : {
                    action  : 'archive',
                    success : true,
                    text    : messageText[true]
                } 
            });
            updateUIElements(tab.id);
        });
    } else {
        addTabToService(tab, function (success) {
            console.log('success:', success);
            var serviceName = services[localStorage.defaultService].name;
            var messageText = {
                'true'  : 'Page added to ' + serviceName + '.',
                'false' : 'There was a problem. Page not added to ' + serviceName + '.'
            };
            chrome.tabs.sendMessage(tab.id, {
                name : 'addResult',
                data : {
                    action  : 'add',
                    success : success,
                    text    : messageText[success]
                }
            });
            updateUIElements(tab.id);
        });
    }
}
function applyDefaultAction() {
    switch (localStorage.defaultAction) {
        case 'showlist':
            cb.setPopup({popup:'list.html'});
        break;
        case 'opentabs':
            cb.setPopup({popup:''});
            cb.onClicked.addListener(function () {
                runFilterSet(null, function () {
                    showAlert('You have no unread links.');
                });
            });
        break;
        case 'openrandom':
            cb.setPopup({popup:''});
            cb.onClicked.addListener(function () {
                var rurItem = getRandomUnreadItem();
                if (rurItem) {
                    openItem(rurItem, false, (ls.defaultPageView == 'reading'), true);
                } else {
                    showAlert('No more unread links.');
                    cb.setPopup({popup:'list.html'});
                }
            });
        break;
    }
}
function beginAuthProcess() {
    chrome.tabs.create({ url: chrome.extension.getURL('oauth.html') }, function (newTab) {
        chrome.tabs.onUpdated.addListener(function thisFunction(tabId, info) {
            if (tabId == newTab.id) {
                if (info.url == 'about:blank' || /invalid/.test(info.url)) {
                    chrome.tabs.onUpdated.removeListener(thisFunction);
                    var finishAuthUrl = chrome.extension.getURL('oauth.html' + '?status=done');
                    chrome.tabs.update(tabId, { url: finishAuthUrl });
                }
            }
        });
    });
}
function getConfirmation(question, callback) {
    callback(confirm(question));
}
function getDefaultIconForActiveTab() {
    switch (activeTabInfo.ps) {
        case 'read'   : return { '19': 'icon-19-c.png', '38': 'icon-19-c@2x.png' };
        case 'unread' : return { '19': 'icon-19-cc.png', '38': 'icon-19-cc@2x.png' };
        default       : return defaultIcon;
    }
}
function handleAddCommand(info, tab) {
    if (localStorage.showAddDialog == 'yes') {
        var url = info.linkUrl || tab.url;
        var oldItem = getItemByUrl(url);
        chrome.tabs.sendMessage(tab.id, {
            name : 'openAddDialog',
            data : {
                title : info.selectionText || tab.title,
                tags  : oldItem ? oldItem.tags : null,
                url   : url
            }
        });
    } else {
        var sendResultToTab = function (success, msgText) {
            chrome.tabs.sendMessage(tab.id, {
                name : 'addResult',
                data : {
                    action  : 'add',
                    success : success,
                    text    : msgText
                }
            });
        };
        if (info.linkUrl) {
            addLinkToService(info.linkUrl, function (success) {
                var serviceName = services[localStorage.defaultService].name;
                var messageText = {
                    'true'  : 'Link added to ' + serviceName + '.',
                    'false' : 'There was a problem. Link not added.'
                };
                sendResultToTab(success, messageText[success]);
            });
        } else {
            addTabToService(tab, function (success) {
                var serviceName = services[localStorage.defaultService].name;
                var messageText = {
                    'true'  : 'Page added to ' + serviceName + '.',
                    'false' : 'There was a problem. Page not added.'
                };
                sendResultToTab(success, messageText[success]);
                _.delay(updateUIElements, 500, tab.id);
            });
        }
    }
}
function handleArchiveCommand(info, tab) {
    var item = getItemByUrl(tab.url);
    item.tabId = tab.id;
    var onSuccess = function () {
        updateUIElements(tab.id);
        chrome.tabs.sendMessage(tab.id, {
            name : 'archiveResult',
            data : {
                action  : 'archive',
                success : true,
                text    : 'Page archived.'
            }
        });
    };
    markItemRead(item, onSuccess);
}
function handleCommand(command) {
    if (command == 'add-current-page') {
        chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
            addOrArchivePage(tabs[0]);
        });
    }
}
function handleRemoveCommand(info, tab) {
    var item = getItemByUrl(tab.url);
    item.tabId = tab.id;
    var onSuccess = function () {
        updateUIElements(tab.id);
        chrome.tabs.sendMessage(tab.id, {
            name : 'archiveResult',
            data : {
                action  : 'remove',
                success : true,
                text    : 'Page removed.'
            }
        });
    };
    deleteItem(item, onSuccess, handleXhrErrorWithAlert);
}
function handleMessage(message, sender, callback) {
    // console.log('Received message "' + message.name + '" from ', sender);
    switch (message.name) {
        case 'passStoredValues':
            var response = {};
            for (var key, i = 0; i < message.data.length; i++) {
                key = message.data[i];
                response[key] = JSON.parse(localStorage[key]);
            }
            callback(response);
            break;
        case 'passTagCollection':
            callback(getAllTags());
            break;
        case 'passTabInfo':
            chrome.tabs.query({active:true}, function (tabs) {
                var tab = tabs[0];
                var item = getItemByUrl(tab.url);
                callback({
                    title : tab.title,
                    url   : tab.url,
                    tags  : item ? item.tags : null
                });
            });
            break;
        case 'addOrArchivePage':
            addOrArchivePage(sender.tab);
            break;
        case 'addTabToService':
            addTabToService(message.data, function (success) {
                console.log('success:', success);
                var serviceName = services[localStorage.defaultService].name;
                var messageText = {
                    'true'  : 'Page added to ' + serviceName + '.',
                    'false' : 'There was a problem. Page not added to ' + serviceName + '.'
                };
                chrome.tabs.sendMessage(sender.tab.id, {
                    name : 'addResult',
                    data : {
                        action  : 'add',
                        success : success,
                        text    : messageText[success]
                    }
                });
                updateUIElements(sender.tab.id);
            });
            break;
        case 'openEditDialog':
            var data = lastSubmittedData;
            chrome.tabs.sendMessage(sender.tab.id, { 
                name : 'openAddDialog',
                data : data
            });
            break;
        case 'closeAddDialog':
        case 'closeMessageBox':
            chrome.tabs.sendMessage(sender.tab.id, { name: message.name });
            break;
        default: break;
    } return true;
}
function handleTabActivate(activeInfo) {
    activeTabInfo.id = activeInfo.tabId;
    if (tabsWatchedForFocus[activeInfo.tabId]) {
        var item = tabsWatchedForFocus[activeInfo.tabId];
        item.tabId = activeInfo.tabId;
        if (localStorage.archiveTrigger === 'focus') {
            markItemRead(item);
        }
        else if (localStorage.archiveTrigger === 'leave') {
            chrome.tabs.get(activeInfo.tabId, function (tab) {
                tabsWatchedForClose[tab.id] = item;
                delete tabsWatchedForFocus[tab.id];
            });
        }
    }
    updateUIElements(activeInfo.tabId);
}
function handleTabRemove(tabId, removeInfo) {
    delete myOpenedTabs[tabId];
    if (tabsWatchedForClose[tabId]) {
        var item = tabsWatchedForClose[tabId];
        item.tabId = tabId;
        markItemRead(item);
    }
}
function handleTabUpdate(tabId, changeInfo, tab) {
    var item;
    if (tabsWatchedForChange[tabId]) {
        if (changeInfo.status === 'complete') {
            item = tabsWatchedForChange[tabId];
            tabsWatchedForClose[tabId] = item;
            delete tabsWatchedForChange[tabId];
            // console.log('Added tab to tabsWatchedForClose:', tabId);
        }
    }
    else if (tabsWatchedForClose[tabId]) {
        item = tabsWatchedForClose[tabId];
        item.tabId = tabId;
        if (changeInfo.url !== item.url && changeInfo.status === 'loading') {
            markItemRead(item);
        }
    }
    if (changeInfo.status == 'loading') {
        updateUIElements(tabId);
    }
}
function handleXhrErrorWithAlert(xhr, immediate) {
    setReportForXhrError(xhr);
    cb.setPopup({popup:'error.html'});
    if (immediate) {
        showAlert('Pickpocket encountered an error. Click the toolbar button for details.');
    }
}
function initializeSettings() {
    var lastVersion = localStorage.lastVersion * 1;
    for (var key in defaults) {
        if (localStorage[key] === undefined) {
            localStorage[key] = defaults[key];
        }
    }
    if (lastVersion < 2) {
        localStorage.archiveTrigger = 'leave';
    }
    if (lastVersion < 4) {
        localStorage.archiveTrigger = localStorage.archiveTrigger || 'none';
    }
    if (lastVersion < 6) {
        localStorage.addContextMenuItem = 'yes';
    }
    if (lastVersion < 7) {
        localStorage.checkInterval = '300';
    }
    if (lastVersion < 9) {
        chrome.tabs.create({ url: "changes.html", active: true });
    }
    if (lastVersion < 12) {
        resetItemCache();
        delete localStorage.username;
        delete localStorage.password;
        localStorage.pinMethod = 'tag';
    }
    if (lastVersion < 13) {
        localStorage.useNewWindow = localStorage.useNewWindow ? 'yes' : 'no';
    }
    if (lastVersion < 15) {
        chrome.tabs.create({ url: "changes.html", active: true });
    }
    if (lastVersion < 16) {
        localStorage.showAddDialog = 'no';
    }
    if (lastVersion < 17) {
        if (localStorage.checkInterval == '') {
            localStorage.checkInterval = '60';
            localStorage.unreadBadge = 'no';
        }
    }
    localStorage.lastVersion = 18;
}
function markItemRead(item, onSuccess, onFailure) {
    // console.log('Archiving:', item.url);
    modifyItem(item, 'archive', null, function (res) {
        item.state = '1';
        if (item.tabId) {
            delete tabsWatchedForClose[item.tabId];
            delete tabsWatchedForFocus[item.tabId];
            delete item.tabId;
        }
        if (localStorage.unreadBadge == 'yes')
            setBadge(-1);
        if (onSuccess) onSuccess(res);
        // console.log('Archive successful.');
    }, onFailure || handleXhrErrorWithAlert);
}
function markItemUnread(item, onSuccess, onFailure) {
    // console.log('Unarchiving:', item.url);
    modifyItem(item, 'readd', null, function (res) {
        item.state = '0';
        if (localStorage.unreadBadge == 'yes')
            setBadge(1);
        if (onSuccess) onSuccess(res);
        // console.log('Unarchive successful.');
    }, onFailure || handleXhrErrorWithAlert);
}
function openItem(item, background, altView, archiveOnTrigger) {
    var onTabCreate = function (newTab) {
        myOpenedTabs[newTab.id] = item;
        if (!archiveOnTrigger) {
            localStorage[item.id] = (localStorage[item.id] || 0) * 1 + 1;
            itemCache.forEach(incrementHitCount, item.id);
        }
        else if (localStorage.archiveTrigger !== 'none') {
            if (background) {
                tabsWatchedForFocus[newTab.id] = item;
            } else {
                if (localStorage.archiveTrigger === 'focus')
                    markItemRead(item);
                else if (localStorage.archiveTrigger === 'leave') {
                    tabsWatchedForChange[newTab.id] = item;
                    // console.log('Added tab to tabsWatchedForChange:', newTab.id);
                }
            }
        }
    };
    var tabProps = {
        url : (altView ^ (ls.defaultPageView == 'reading')) ? services.pocket.endpoints.read + item.id : item.url,
        active : !background
    };
    chrome.tabs.query({active:true}, function (tabs) {
        var sTab = tabs[0];
        if (!background && sTab.url === 'chrome://newtab/' || sTab.url === 'about:blank') {
            chrome.tabs.update(tabProps, onTabCreate);
        } else {
            chrome.tabs.create(tabProps, onTabCreate);
        }
    });
}
function openItems(items, altView) {
    var openTabs = function (win) {
        chrome.tabs.query({active:true}, function (tabs) {
            for (var i = items.length - 1; i >= 0; i--) {
                openItem(items[i], true, altView, true);
            }
        });
    };
    if (localStorage.useNewWindow == 'yes') {
        chrome.windows.create({url:'about:blank'}, openTabs);
    } else {
        chrome.windows.getCurrent({populate:true}, openTabs);
    }
}
function setBadge(input) {
    if (input === undefined) {
        var unreadCount = itemCache.filter(isUnread).length;
        input = unreadCount ? unreadCount + '' : '';
    }
    if (typeof input == 'string') {
        cb.setBadgeText({text:input});
    }
    else if (typeof input == 'number') {
        cb.getBadgeText({}, function (text) {
            text = ((text * 1 + input) || '') + '';
            cb.setBadgeText({text:text});
        });
    }
}
function setButtonIcon(paths) {
    cb.setIcon({ path: paths });
}
function setReportForXhrError(xhr) {
    var message = 
        '<p>' + services[localStorage.defaultService].name + ' returned the following error message:</p>' +
        '<blockquote>' +
            '<p><b><code>' + xhr.getResponseHeader('Status') + '</code></b></p>' +
            '<p><code>' + xhr.getResponseHeader('X-Error') + '</code></p>' +
        '</blockquote>';
    var callback = (xhr.status == 401) ? beginAuthProcess : null;
    var forceOK = (xhr.status == 401) ? true : false;
    setReportObject(message, callback, false, forceOK);
}
function setReportObject(message, callback, binary, forceOK) {
    reportObject = {
        message  : message,
        callback : callback,
        binary   : binary,
        forceOK  : forceOK
    };
}
function showAlert(message, callback) {
    alert(message);
    if (callback) callback();
}
function toggleContextMenuItems() {
    chrome.contextMenus.removeAll();
    if (localStorage.addContextMenuItem == 'yes') {
        chrome.contextMenus.create({
            id       : 'page-cmi-0',
            title    : 'Add to ' + services[localStorage.defaultService].name,
            contexts : ['page','selection','link'],
            onclick  : handleAddCommand
        });
        cmItems['page-cmi-0'] = true;
    }
}
function updateContextMenu() {
    if (localStorage.addContextMenuItem != 'yes')
        return;
    var svcName = services[localStorage.defaultService].name;
    if (cmItems['page-cmi-1']) {
        chrome.contextMenus.remove('page-cmi-1');
        cmItems['page-cmi-1'] = false;
    }
    switch (activeTabInfo.ps) {
        case 'absent':
            chrome.contextMenus.update('page-cmi-0', {
                title   : 'Add to ' + svcName,
                onclick : handleAddCommand
            });
        break;
        case 'unread':
            chrome.contextMenus.update('page-cmi-0', {
                title   : 'Move Page to ' + svcName + ' Archive',
                onclick : handleArchiveCommand
            });
            chrome.contextMenus.create({
                id       : 'page-cmi-1',
                title    : 'Remove Page from ' + svcName,
                contexts : ['page'],
                onclick  : handleRemoveCommand
            });
            cmItems['page-cmi-1'] = true;
        break;
        case 'read':
            chrome.contextMenus.update('page-cmi-0', {
                title   : 'Move Page to ' + svcName + ' Queue',
                onclick : handleAddCommand
            });
            chrome.contextMenus.create({
                id       : 'page-cmi-1',
                title    : 'Remove Page from ' + svcName,
                contexts : ['page'],
                onclick  : handleRemoveCommand
            });
            cmItems['page-cmi-1'] = true;
        break;
    }
}
function updateUIElements(tabId) {
    chrome.tabs.get(tabId, function (tab) {
        var matchingItem = getItemByUrl(tab.url);
        if (matchingItem) {
            activeTabInfo.ps = (matchingItem.state == '1') ? 'read' : 'unread';
            if (localStorage.colorizeButton == 'yes')
                setButtonIcon(getDefaultIconForActiveTab());
            updateContextMenu();
        } else {
            activeTabInfo.ps = 'absent';
            if (localStorage.colorizeButton == 'yes')
                setButtonIcon(defaultIcon);
            updateContextMenu();
        }
    });
}

var safari = false;
var cb = chrome.browserAction;
var defaultIcon = {
    '19': localStorage.defaultBlueIcon == 'yes' ? 'icon-19-cc.png'    : 'icon-19.png',
    '38': localStorage.defaultBlueIcon == 'yes' ? 'icon-19-cc@2x.png' : 'icon-19@2x.png'
};
var waitingIcon = {
    '19': 'icon-19-w.png',
    '38': 'icon-19-w@2x.png'
};
var activeTabInfo = {};
var myOpenedTabs = {};
var tabsWatchedForFocus = {};
var tabsWatchedForChange = {};
var tabsWatchedForClose = {};
var reportObject = {};
var cmItems = {};

toggleContextMenuItems();

defaults.colorizeButton = 'no';
defaults.defaultBlueIcon = 'no';

chrome.runtime.onMessage.addListener(handleMessage);

chrome.tabs.onActivated.addListener(handleTabActivate);
chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.tabs.onRemoved.addListener(handleTabRemove);

chrome.commands.onCommand.addListener(handleCommand);

setButtonIcon(defaultIcon);
cb.setBadgeBackgroundColor({color:'#ff4c62'});

initialize();
