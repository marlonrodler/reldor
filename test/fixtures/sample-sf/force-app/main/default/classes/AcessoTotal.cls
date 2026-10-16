public without sharing class AcessoTotal {
    // Busca todas as contas, sem respeitar o compartilhamento
    public static List<Account> todasAsContas() {
        return [SELECT Id, Name FROM Account];
    }
}
