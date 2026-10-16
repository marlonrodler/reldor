public class ScoreJob implements Queueable {
    public void execute(QueueableContext ctx) {
        List<Proposta__c> propostas = new List<Proposta__c>();
        insert propostas;
    }
}
