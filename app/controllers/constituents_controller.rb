class ConstituentsController < ApplicationController

  respond_to :html, :json

  def index
  end

  def map
    @admin = params[:admin] != nil
  end

  def export
    client = Elasticsearch::Client.new host: connection_string
    begin
      q = URI.unescape(params[:q])
      fields = ["*"]
      r = client.search index: 'pic', size: 100, body: q, _source: fields
    rescue
      @results = nil
    end
    if r && r["hits"]["total"] > 0
      @results = r["hits"]["hits"]
    end
    render :json => {:results => @results}
  end

  def show
    client = Elasticsearch::Client.new host: connection_string
    begin
      results = client.search index: 'pic', q: "constituent.ConstituentID:#{params[:id]}"
    rescue
      @constituent = nil
    end
    if results && results["hits"]["total"] > 0
      @constituent = results["hits"]["hits"][0]["_source"]
    end
    respond_with @constituent do |f|
      f.html
      f.json
    end
  end

end
