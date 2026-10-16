public with sharing class PainelController {
    // Lista as contas do painel
    @AuraEnabled(cacheable=true)
    public static List<Account> contas() {
        return AcessoTotal.todasAsContas();
    }
}
