@isTest
private class AccountsTest {
    @isTest static void deveCalcularScore() {
        insert new Account(Name = 'Teste', CPF__c = '123');
        AccountsServiceImpl s = new AccountsServiceImpl();
    }
}
