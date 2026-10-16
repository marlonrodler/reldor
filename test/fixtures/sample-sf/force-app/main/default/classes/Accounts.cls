public with sharing class Accounts extends fflib_SObjectDomain {
    public Accounts(List<Account> records) { super(records); }
    // Recalcula o score quando a conta muda
    public override void onBeforeUpdate(Map<Id, SObject> existing) {
        if (Bypass__c.getInstance().Desligar_Triggers__c) return;
        IAccountsService service = (IAccountsService) Application.Service.newInstance(IAccountsService.class);
        service.calcularScore(Records);
    }
    public class Constructor implements fflib_SObjectDomain.IConstructable {
        public fflib_SObjectDomain construct(List<SObject> records) { return new Accounts(records); }
    }
}
