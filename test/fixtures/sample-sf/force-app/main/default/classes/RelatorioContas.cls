public with sharing class RelatorioContas {
    // Monta o resumo das contas de um segmento
    public static List<String> resumo(String segmento) {
        List<String> linhas = new List<String>();
        for (Account conta : [SELECT Id, Name FROM Account WHERE Segmento__c = :segmento]) {
            linhas.add(conta.Name + ' ' + conta.Score__c);
        }
        return linhas;
    }
}
