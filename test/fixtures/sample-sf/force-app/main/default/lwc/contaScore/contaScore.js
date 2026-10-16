import { LightningElement, wire } from 'lwc';
import buscar from '@salesforce/apex/ContaController.buscar';
import SCORE from '@salesforce/schema/Account.Score__c';
export default class ContaScore extends LightningElement {}
