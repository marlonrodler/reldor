public with sharing class AccountsServiceImpl implements IAccountsService {
    public void calcularScore(List<Account> contas) {
        List<Account> atuais = [SELECT Id, Score__c, Segmento__c FROM Account WHERE Id IN :contas];
        for (Account a : contas) { a.Score__c = 10; }
        System.enqueueJob(new ScoreJob());
    }
}
