class Token {
    constructor(text, index, parser) {
        this.text = text;
        this.index = index;
        this.parser = parser

        // Classify the token.
        if (/^[A-Za-z_]/.test(text)) {
            this.kind = 'identifier';
        } else if (/^[0-9]/.test(text)) {
            this.kind = 'number';
        } else {
            this.kind = 'operator';
        }
    }
}

export class ExpressionError extends Error {
    constructor(message, token) {
        super(message);
        this.token = token;
    }
}

class ExpressionInternalError extends ExpressionError {

}

class ExpressionFormatError extends ExpressionError {

}

class ExpressionSyntaxError extends ExpressionError {

}

class Expression {
    constructor(precedence, optoken, arglist) {
        this.precedence = precedence;
        this.optoken = optoken;
        this.arglist = arglist;
    }

    LogicTree() {
        throw new ExpressionInternalError('Conversion to LogicTree not implemented', this.optoken)
    }

    LogicTree_Binary_LeftAssoc(opsymbol) {
        let left = this.arglist[0].LogicTree();
        let right = this.arglist[1].LogicTree();

        return left + ' ' + (opsymbol || this.optoken.text) + ' ' + right;
    }

    LogicTree_Binary_RightAssoc(opsymbol) {
        let left = this.arglist[0].LogicTree();
        let right = this.arglist[1].LogicTree();

        return left + (opsymbol || this.optoken.text) + right;
    }

    LogicTree_SingleArg() {
        if (this.arglist.length !== 1) {
            throw new ExpressionFormatError(`The function "${this.optoken.text}" requires exactly one argument.`, this.optoken)
        }
        return this.arglist[0].LogicTree();
    }

    QueryVars() {
        throw new ExpressionInternalError('Conversion to QueryVars not implemented', this.optoken)
    }
}

class ExpressionAnd extends Expression {
    constructor(optoken, left, right) {
        super(1, optoken, [left, right]);
    }

    LogicTree() {
        return this.LogicTree_Binary_LeftAssoc();
    }

    QueryVars() {
        let left = this.arglist[0].QueryVars();
        let right = this.arglist[1].QueryVars();

        return {
            connector: 'and',
            left,
            right
        }
    }
}

class ExpressionOr extends Expression {
    constructor(optoken, left, right) {
        super(1, optoken, [left, right]);
    }

    LogicTree() {
        return this.LogicTree_Binary_LeftAssoc();
    }

    QueryVars() {
        let left = this.arglist[0].QueryVars();
        let right = this.arglist[1].QueryVars();

        return {
            connector: 'or',
            left,
            right
        }
    }
}

class ExpressionComparison extends Expression {
    constructor(optoken, left, right) {
        super(2, optoken, [left, right]);
    }

    LogicTree() {
        return this.LogicTree_Binary_LeftAssoc();
    }

    QueryVars() {
        let left = this.arglist[0].QueryVars();
        let right = this.arglist[1].QueryVars();

        return {
            left,
            right,
            operation: this.optoken.text
        }
    }
}

class ExpressionNumber extends Expression {
    constructor(token) {
        super(9, token, []);
    }

    LogicTree() {
        return this.optoken.text;
    }

    QueryVars() {
        return parseFloat(this.optoken.text)
    }
}

class ExpressionFunction extends Expression {
    constructor(token, func, arglist) {
        super(9, token, [func, ...arglist]);
    }

    LogicTree() {
        if (this.optoken.parser.fieldNames.indexOf(this.optoken.text) === -1) {
            throw new ExpressionFormatError('Unknown field "' + this.optoken.text + '"', this.optoken)
        }

        switch (this.arglist[0].text) {
            // TODO: create thing for each function
            case 'avg':
                return 'avg' + this.arglist?.[1]?.LogicTree() + '(' + this.optoken.text + ')';
            case 'min':
                return 'min' + this.arglist?.[1]?.LogicTree() + '(' + this.optoken.text + ')';
            case 'max':
                return 'max' + this.arglist?.[1]?.LogicTree() + '(' + this.optoken.text + ')';
            case 'count':
                return 'count' + this.arglist?.[1]?.LogicTree() + '(' + this.optoken.text + ')';
            case 'last':
                return 'last' + this.arglist?.[1]?.LogicTree() + '(' + this.optoken.text + ')';
            // case 'nodata': // Count = 0
            //     return 'nodata' + this.arglist?.[1]?.LogicTree() + '(' + this.optoken.text + ')';

            default:
                throw new ExpressionFormatError('Unknown function "' + this.arglist[0].text + '"', this.arglist[0])
        }
    }

    QueryVars() {
        if (this.optoken.parser.fieldNames.indexOf(this.optoken.text) === -1) {
            throw new ExpressionFormatError('Unknown field "' + this.optoken.text + '"', this.optoken)
        }

        if (this.arglist.length <= 1) {
            throw new ExpressionFormatError('Function requires atleast 1 argument', this.arglist[0])
        }

        switch (this.arglist[0].text) {
            case 'avg':
            case 'min':
            case 'max':
                return {
                    type: 'bucket',
                    func: this.arglist[0].text,
                    field: this.optoken.text,
                    args: this.arglist.slice(1).map(arg => arg.QueryVars())
                }
            case 'count':
                return {
                    type: 'count',
                    func: this.arglist[0].text,
                    field: this.optoken.text,
                    args: this.arglist.slice(1).map(arg => arg.QueryVars())
                }
            case 'last':
                return {
                    type: 'last',
                    func: this.arglist[0].text,
                    field: this.optoken.text,
                    args: this.arglist.slice(1).map(arg => arg.QueryVars())
                }
            // case 'nodata': // Count = 0
            //     return 'nodata' + this.arglist?.[1]?.LogicTree() + '(' + this.optoken.text + ')';

            default:
                throw new ExpressionFormatError('Unknown function "' + this.arglist[0].text + '"', this.arglist[0])
        }
    }
}

export class Parser {
    constructor(text, fieldNames) {
        this.nextTokenIndex = 0;
        this.tokenList = [];
        this.fieldNames = fieldNames
        const reToken = /[0-9]+(\.[0-9]*)?([eE][\+\-]?[0-9]+)?|[A-Za-z_][A-Za-z_0-9]*|[<>=]{1,2}|\S/g;
        for (; ;) {
            const match = reToken.exec(text);
            if (match === null) {
                break;
            }
            this.tokenList.push(new Token(match[0], match.index, this));
        }
    }

    Parse() {
        const expr = this.ParseExpr();
        if (this.nextTokenIndex < this.tokenList.length) {
            throw new ExpressionSyntaxError('Syntax error', this.tokenList[this.nextTokenIndex])
        }
        return expr;
    }

    ParseExpr() {
        // expr ::= fieldexpr { addop fieldexpr }
        let expr = this.ParseFieldExpr();
        let optoken;
        while (optoken = this.NextTokenIs(['and', 'or'])) {
            const right = this.ParseFieldExpr();
            if (optoken.text === 'and') {
                expr = new ExpressionAnd(optoken, expr, right);
            } else {
                expr = new ExpressionOr(optoken, expr, right);
            }
        }
        return expr;
    }

    ParseFieldExpr() {
        // fieldexpr ::= fieldvalexpr compop numeric | "(" expr ")"
        let expr
        if (this.NextTokenIs(['('])) {
            expr = this.ParseExpr()
            this.ExpectToken(')');
            return expr
        }

        expr = this.ParseFieldValExpr();
        const optoken = this.NextTokenIs(['<', '<=', '>', '>=', '=', '<>'])
        if (optoken) {
            const right = this.ParseNumber()
            return new ExpressionComparison(optoken, expr, right);
        }
        throw new ExpressionSyntaxError('Comparison operand expected', expr.optoken)
    }

    ParseFieldValExpr() {
        // fieldvalexpr ::= field "." funcexpr | numeric
        const token = this.GetNextToken();

        if (token.kind === 'number') {
            return new ExpressionNumber(token);
        }

        if (token.kind === 'identifier') {
            if (this.NextTokenIs(['.'])) {
                const funcToken = this.GetNextToken()
                if (funcToken.kind !== 'identifier') {
                    throw new ExpressionSyntaxError('Field name must be followed by .<function>', token)
                }
                let arglist = []
                if (this.NextTokenIs(['('])) {
                    arglist = this.ParseParams();
                    this.ExpectToken(')');
                }
                return new ExpressionFunction(token, funcToken, arglist);
            }
            throw new ExpressionSyntaxError('Field name must be followed by .<function>', token)
        }

        throw new ExpressionSyntaxError('Expected field name or number', token)
    }

    ParseParams() {
        // paramexpr ::= numeric { "," numeric }
        let expr = this.ParseNumber();
        const args = [expr]
        while (this.NextTokenIs([','])) {
            expr = this.ParseNumber();
            args.push(expr)
        }
        return args;
    }

    ParseNumber() {
        const token = this.GetNextToken();

        if (token.kind === 'number') {
            return new ExpressionNumber(token);
        }

        throw new ExpressionSyntaxError('Expected number', token)
    }

    PeekNextToken() {
        if (this.nextTokenIndex < this.tokenList.length) {
            return this.tokenList[this.nextTokenIndex];
        }
        return null;
    }

    GetNextToken() {
        if (this.nextTokenIndex < this.tokenList.length) {
            return this.tokenList[this.nextTokenIndex++];
        }
        throw new ExpressionSyntaxError('Unexpected end of expression', this.optoken)
    }

    NextTokenIs(validOptionList) {
        if (this.nextTokenIndex < this.tokenList.length) {
            const text = this.tokenList[this.nextTokenIndex].text;
            if (validOptionList.indexOf(text) >= 0) {
                return this.tokenList[this.nextTokenIndex++];
            }
        }
        return null;
    }

    ExpectToken(text) {
        const token = this.PeekNextToken();
        if (token === null || token.text !== text) {
            throw new ExpressionSyntaxError('Expected "' + text + '"', this.optoken)
        }
        return this.tokenList[this.nextTokenIndex++];
    }
}