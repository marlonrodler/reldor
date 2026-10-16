public with sharing class ContaController {
    @AuraEnabled(cacheable=true)
    public static List<Account> buscar() { return [SELECT Id, Name FROM Account LIMIT 10]; }
    public static Type dinamico() { return Type.forName('AccountsServiceImpl'); }
}
