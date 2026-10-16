public inherited sharing class AccountsSelector extends fflib_SObjectSelector {
    public Schema.SObjectType getSObjectType() { return Account.SObjectType; }
    public List<Schema.SObjectField> getSObjectFieldList() {
        return new List<Schema.SObjectField>{ Account.Id, Account.Name, Account.CPF__c };
    }
}
