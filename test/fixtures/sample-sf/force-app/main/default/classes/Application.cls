public class Application {
    public static final fflib_Application.ServiceFactory Service = new fflib_Application.ServiceFactory(
        new Map<Type, Type>{ IAccountsService.class => AccountsServiceImpl.class });
    public static final fflib_Application.SelectorFactory Selector = new fflib_Application.SelectorFactory(
        new Map<SObjectType, Type>{ Account.SObjectType => AccountsSelector.class });
    public static final fflib_Application.DomainFactory Domain = new fflib_Application.DomainFactory(
        Application.Selector, new Map<SObjectType, Type>{ Account.SObjectType => Accounts.Constructor.class });
}
