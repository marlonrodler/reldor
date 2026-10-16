trigger AccountTrigger on Account (before insert, before update, after update) {
    fflib_SObjectDomain.triggerHandler(Accounts.class);
}
